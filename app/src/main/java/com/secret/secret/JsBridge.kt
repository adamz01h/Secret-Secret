package com.secret.secret

import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

class JsBridge(private val db: AppDatabase) {

    // ----------------------
    // MY ACCOUNT KEYS (versioned)
    // ----------------------

    @JavascriptInterface
    fun addMyAccountKey(name: String, psk: String) {
        val cursor = db.readableDatabase.rawQuery(
            "SELECT MAX(psk_version) FROM my_account_keys", null
        )
        var nextVersion = 1
        if (cursor.moveToFirst()) {
            val maxVersion = cursor.getInt(0)
            if (maxVersion > 0) nextVersion = maxVersion + 1
        }
        cursor.close()

        db.writableDatabase.execSQL(
            "INSERT INTO my_account_keys (name, psk, psk_version, active) VALUES (?, ?, ?, 1)",
            arrayOf(name, psk, nextVersion)
        )

        // deactivate previous keys
        db.writableDatabase.execSQL(
            "UPDATE my_account_keys SET active=0 WHERE psk_version<?",
            arrayOf(nextVersion)
        )
    }

    @JavascriptInterface
    fun getCurrentMyAccount(): String {
        val cursor = db.readableDatabase.rawQuery(
            "SELECT name, psk, psk_version FROM my_account_keys WHERE active=1", null
        )
        val obj = JSONObject()
        if (cursor.moveToFirst()) {
            obj.put("name", cursor.getString(0))
            obj.put("psk", cursor.getString(1))
            obj.put("psk_version", cursor.getInt(2))
        }
        cursor.close()
        return obj.toString()
    }

    @JavascriptInterface
    fun getMyAccountKeys(): String {
        val cursor = db.readableDatabase.rawQuery(
            "SELECT name, psk, psk_version, active FROM my_account_keys ORDER BY psk_version ASC",
            null
        )
        val arr = JSONArray()
        while (cursor.moveToNext()) {
            val obj = JSONObject()
            obj.put("name", cursor.getString(0))
            obj.put("psk", cursor.getString(1))
            obj.put("psk_version", cursor.getInt(2))
            obj.put("active", cursor.getInt(3))
            arr.put(obj)
        }
        cursor.close()
        return arr.toString()
    }

    @JavascriptInterface
    fun saveMyAccount(name: String, psk: String) {
        val dbw = db.writableDatabase

        try {
            // 1. Check for current active key
            val cursor = dbw.rawQuery(
                "SELECT psk, psk_version FROM my_account_keys WHERE active=1 LIMIT 1",
                null
            )

            var activePsk: String? = null
            if (cursor.moveToFirst()) {
                activePsk = cursor.getString(0)
            }
            cursor.close()

            // 2. No active key → first-time insert
            if (activePsk == null) {
                dbw.execSQL(
                    "INSERT INTO my_account_keys (name, psk, psk_version, active) VALUES (?, ?, 1, 1)",
                    arrayOf(name, psk)
                )
                return
            }

            // 3. Key unchanged → just update name
            if (activePsk == psk) {
                dbw.execSQL(
                    "UPDATE my_account_keys SET name=? WHERE active=1",
                    arrayOf(name)
                )
                return
            }

            // 4. Key changed → insert new version
            val vCursor = dbw.rawQuery(
                "SELECT IFNULL(MAX(psk_version), 0) + 1 FROM my_account_keys",
                null
            )
            vCursor.moveToFirst()
            val nextVersion = vCursor.getInt(0)
            vCursor.close()

            // Deactivate old key
            dbw.execSQL(
                "UPDATE my_account_keys SET active=0 WHERE active=1"
            )

            // Insert new key
            dbw.execSQL(
                "INSERT INTO my_account_keys (name, psk, psk_version, active) VALUES (?, ?, ?, 1)",
                arrayOf(name, psk, nextVersion)
            )

        } catch (e: Exception) {
            android.util.Log.e("JsBridge", "saveMyAccount failed", e)
            throw e
        }
}


    // ----------------------
    // CONTACTS
    // ----------------------

    @JavascriptInterface
    fun addContact(name: String, psk: String) {
        val dbw = db.writableDatabase

        // 1. Insert contact identity
        dbw.execSQL(
            "INSERT INTO contacts (name) VALUES (?)",
            arrayOf(name)
        )

        // 2. Get the last inserted contact ID
        val cursor = dbw.rawQuery("SELECT last_insert_rowid()", null)
        cursor.moveToFirst()
        val contactId = cursor.getLong(0)
        cursor.close()

        // 3. Insert first key (version 1)
        dbw.execSQL(
            """
            INSERT INTO contact_keys (contact_id, psk, psk_version, active)
            VALUES (?, ?, 1, 1)
            """.trimIndent(),
            arrayOf(contactId, psk)
        )
    }

    @JavascriptInterface
    fun updateContact(contactId: Int, name: String, psk: String) {
        val dbw = db.writableDatabase

        // 1. Update contact identity
        dbw.execSQL(
            "UPDATE contacts SET name=? WHERE id=?",
            arrayOf(name, contactId)
        )

        // 2. Get current active key
        val cursor = dbw.rawQuery(
            "SELECT psk FROM contact_keys WHERE contact_id=? AND active=1 LIMIT 1",
            arrayOf(contactId.toString())
        )

        if (cursor.moveToFirst()) {
            val currentPsk = cursor.getString(0)
            if (currentPsk == psk) {
                cursor.close()
                return // key unchanged, no version increment needed
            }
        }
        cursor.close()

        // 3. Compute next version
        val vCursor = dbw.rawQuery(
            "SELECT IFNULL(MAX(psk_version), 0) + 1 FROM contact_keys WHERE contact_id=?",
            arrayOf(contactId.toString())
        )
        vCursor.moveToFirst()
        val nextVersion = vCursor.getInt(0)
        vCursor.close()

        // 4. Deactivate old keys
        dbw.execSQL(
            "UPDATE contact_keys SET active=0 WHERE contact_id=?",
            arrayOf(contactId)
        )

        // 5. Insert new key
        dbw.execSQL(
            "INSERT INTO contact_keys (contact_id, psk, psk_version, active) VALUES (?, ?, ?, 1)",
            arrayOf(contactId, psk, nextVersion)
        )
    }

@JavascriptInterface
fun deleteContact(contactId: Int) {
    val dbw = db.writableDatabase

    try {
        // 1. Delete messages
        dbw.execSQL("DELETE FROM messages WHERE contact_id=?", arrayOf(contactId))

        // 2. Delete keys explicitly if cascade not enabled
        dbw.execSQL("DELETE FROM contact_keys WHERE contact_id=?", arrayOf(contactId))

        // 3. Delete contact
        dbw.execSQL("DELETE FROM contacts WHERE id=?", arrayOf(contactId))
    } catch (e: Exception) {
        android.util.Log.e("JsBridge", "deleteContact failed", e)
        throw e
    }
}

    @JavascriptInterface
    fun getContacts(): String {
    val cursor = db.readableDatabase.rawQuery(
            "SELECT c.id, c.name, k.psk, k.psk_version FROM contacts c " +
            "LEFT JOIN contact_keys k ON k.contact_id=c.id AND k.active=1",
            null
        )

        val arr = JSONArray()
        while (cursor.moveToNext()) {
            val obj = org.json.JSONObject()
            obj.put("id", cursor.getInt(0))
            obj.put("name", cursor.getString(1))
            obj.put("psk", cursor.getString(2))
            obj.put("psk_version", cursor.getInt(3))
            arr.put(obj)
        }
        cursor.close()
        return arr.toString()
    }

        @JavascriptInterface
    fun getContact(contactId: Int): String {
        val cursor = db.readableDatabase.rawQuery(
            """
             SELECT c.id, c.name, k.psk, k.psk_version
        FROM contacts c
        LEFT JOIN contact_keys k 
            ON k.contact_id = c.id AND k.active = 1
        WHERE c.id = ?
            """.trimIndent(),
        arrayOf(contactId.toString())
        )


        val arr = org.json.JSONArray()
         if (cursor.moveToFirst()) {
             val obj = org.json.JSONObject()
             obj.put("id", cursor.getInt(0))
             obj.put("name", cursor.getString(1))
             obj.put("psk", cursor.getString(2))
             obj.put("psk_version", cursor.getInt(3))
             arr.put(obj)
         }
        cursor.close()
        return arr.toString()
    }
    // ----------------------
    // MESSAGES
    // ----------------------

    @JavascriptInterface
    fun addMessage(contactId: Int, direction: String, ciphertext: String, timestamp: Long, pskVersion: Int) {
        db.writableDatabase.execSQL(
            "INSERT INTO messages (contact_id, direction, ciphertext, timestamp, psk_version) VALUES (?, ?, ?, ?, ?)",
            arrayOf(contactId, direction, ciphertext, timestamp, pskVersion)
        )
    }

    @JavascriptInterface
    fun getMessages(): String {
        val cursor = db.readableDatabase.rawQuery("""
            SELECT messages.id, messages.contact_id, messages.direction, messages.ciphertext,
                   messages.timestamp, messages.psk_version, contacts.name
            FROM messages
            LEFT JOIN contacts ON contacts.id = messages.contact_id
            ORDER BY messages.timestamp DESC
        """, null)

        val arr = JSONArray()
        while (cursor.moveToNext()) {
            val obj = JSONObject()
            obj.put("id", cursor.getInt(0))
            obj.put("contact_id", cursor.getInt(1))
            obj.put("direction", cursor.getString(2))
            obj.put("ciphertext", cursor.getString(3))
            obj.put("timestamp", cursor.getLong(4))
            obj.put("psk_version", cursor.getInt(5))
            obj.put("contact_name", cursor.getString(6))
            arr.put(obj)
        }
        cursor.close()
        return arr.toString()
    }

 @JavascriptInterface
fun getMessagesForContact(contactId: Int): String {
    val cursor = db.readableDatabase.rawQuery("""
        SELECT messages.id, messages.contact_id, messages.direction, messages.ciphertext,
               messages.timestamp, messages.psk_version, contacts.name
        FROM messages
        LEFT JOIN contacts ON contacts.id = messages.contact_id
        WHERE messages.contact_id = ?
        ORDER BY messages.timestamp ASC
    """, arrayOf(contactId.toString()))

    val arr = JSONArray()
    while (cursor.moveToNext()) {
        val obj = JSONObject()
        obj.put("id", cursor.getInt(0))
        obj.put("contact_id", cursor.getInt(1))
        obj.put("direction", cursor.getString(2))
        obj.put("ciphertext", cursor.getString(3))
        obj.put("timestamp", cursor.getLong(4))
        obj.put("psk_version", cursor.getInt(5))
        obj.put("contact_name", cursor.getString(6))
        arr.put(obj)
    }
    cursor.close()
    return arr.toString()
}

@JavascriptInterface
fun getMyPskByVersion(version: Int): String? {
    val cursor = db.readableDatabase.rawQuery(
        "SELECT psk FROM my_account_keys WHERE psk_version=?",
        arrayOf(version.toString())
    )

    var psk: String? = null
    if (cursor.moveToFirst()) {
        psk = cursor.getString(0)
    }
    cursor.close()
    return psk
}

@JavascriptInterface
fun getContactPskByVersion(contactId: Int, version: Int): String? {
    val cursor = db.readableDatabase.rawQuery(
        "SELECT psk FROM contact_keys WHERE contact_id=? AND psk_version=?",
        arrayOf(contactId.toString(), version.toString())
    )

    var psk: String? = null
    if (cursor.moveToFirst()) {
        psk = cursor.getString(0)
    }
    cursor.close()
    return psk
}



}

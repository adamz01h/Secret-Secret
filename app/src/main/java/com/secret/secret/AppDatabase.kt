package com.secret.secret

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AppDatabase(context: Context) :
    SQLiteOpenHelper(context, "app.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        // ----------------------
        // Contacts (identity only)
        // ----------------------
        db.execSQL(
            """
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            )
            """.trimIndent()
        )

        // ----------------------
        // Contact Keys (versioned)
        // ----------------------
        db.execSQL(
            """
            CREATE TABLE contact_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL,
                psk TEXT NOT NULL,
                psk_version INTEGER NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
                UNIQUE(contact_id, psk_version)
            )
            """.trimIndent()
        )

        // ----------------------
        // My Account Keys (versioned)
        // ----------------------
        db.execSQL(
            """
            CREATE TABLE my_account_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                psk TEXT NOT NULL,
                psk_version INTEGER NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                UNIQUE(psk_version)
            )
            """.trimIndent()
        )


        // ----------------------
        // Messages table
        // ----------------------
        db.execSQL("""
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL,
                direction TEXT NOT NULL,
                ciphertext TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                psk_version INTEGER NOT NULL,
                FOREIGN KEY(contact_id) REFERENCES contacts(id)
            )
        """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Since we are starting fresh, simply drop tables and recreate
        db.execSQL("DROP TABLE IF EXISTS messages")
        db.execSQL("DROP TABLE IF EXISTS contact_keys")
        db.execSQL("DROP TABLE IF EXISTS contacts")
        db.execSQL("DROP TABLE IF EXISTS my_account_keys")
        onCreate(db)
    }

    // Optional helper to clear all data (useful for testing)
    fun clearDatabase() {
        writableDatabase.execSQL("DELETE FROM messages")
        writableDatabase.execSQL("DELETE FROM contact_keys")
        writableDatabase.execSQL("DELETE FROM contacts")
        writableDatabase.execSQL("DELETE FROM my_account_keys")
    }
}

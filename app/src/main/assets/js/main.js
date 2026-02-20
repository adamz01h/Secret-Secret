const contactList = document.getElementById("contactList");
const contactSelect = document.getElementById("contactSelect");
const scanContactSelect = document.getElementById("scanContactSelect");
const messageList = document.getElementById("messageList");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const result = document.getElementById("result");

let scanning = false;
let animationFrameId = null;
let videoStream = null;
let lastScan = "";
let activeContactId = null;

const $contactList = $("#contactList");
const $contactsPage = $("#contactsPage");
const $messagesPage = $("#messagesPage");
const $addContactsPage = $("#addContactsPage");
const $backBtn = $(".backBtn");
const $activeContactName = $("#activeContactName");
const $addMyAccount = $("#addMyAccount");

console.log(wordlist);
if (!window.AndroidDB) {
  console.log("no AndroidDB");
} else {
  load_contacts();
}

//sendMessageBtn
$("#sendMessageBtn").on("click", async function () {
  const message = $("#messageText").val().trim();
  const psk = $("#edit_contact").attr("data-psk").trim();

  if (message.length == 0) {
    alert("Message cannot be blank");
    return;
  }
  try {
    const encrypted = await encryptMessage(psk, message);
    console.log(psk);
    console.log(encrypted);
    $("#enctext").val(encrypted);
    $("#QRModal").show();
    const qrContainer = document.getElementById("mymessageqrcode");
    qrContainer.innerHTML = "";
    renderqr_code(qrContainer, encrypted);
  } catch (e) {
    console.error("Encryption failed", e);
    alert("Encryption failed: " + e);
  }
});

//  // Save encrypted message as outbound
$("#confirm_sent").on("click", function () {
  const contactId = parseInt($("#edit_contact").attr("data-id"));
  const encrypted = $("#enctext").val();
  const contact = JSON.parse(AndroidDB.getContact(contactId))[0];
  const contactPskVersion = parseInt(contact.psk_version);

  console.log(contactId);
  console.log(encrypted);
  console.log(contactPskVersion);

  AndroidDB.addMessage(contactId, "outbound", encrypted, Date.now(), contactPskVersion);
  getDecodedMessages(contactId).then((messages) => {
    renderChat(messages);
  });
  $("#QRModal").hide();
  $("#messageText").val("");
});

$("#close_decodeModal").on("click", function () {
  $("#decodeModal").hide();
});

$("#decode_message").on("click", async function () {
  var enc = $("#encmessage").val().trim();
  const contactId = parseInt($("#edit_contact").attr("data-id"));
  let info = AndroidDB.getCurrentMyAccount();
  i = JSON.parse(info);
  var psk = i.psk;
  var contactPskVersion = i.psk_version;
  try {
    const decrypted = await decryptMessage(psk, enc);
    console.log(decrypted);
    console.log(enc);
    console.log(psk);
    console.log(contactPskVersion);
    $("#decodedmsg").html(decrypted);
  } catch (e) {}
});

//store message
$("#store_message").on("click", function () {
  var decrypted = $("#decodedmsg").html();
  var enc = $("#encmessage").val().trim();
  const contactId = parseInt($("#edit_contact").attr("data-id"));
  let info = AndroidDB.getCurrentMyAccount();
  i = JSON.parse(info);
  var contactPskVersion = i.psk_version;
  if (decrypted) {
    AndroidDB.addMessage(contactId, "inbound", enc, Date.now(), contactPskVersion);
    getDecodedMessages(contactId).then((messages) => {
      renderChat(messages);
    });
  }
  $("#decodeModal").hide();
});

//decode_message
$("#decode_message").on("click", async function () {
  var enc = $("#encmessage").val().trim();
  const contactId = parseInt($("#edit_contact").attr("data-id"));
  let info = AndroidDB.getCurrentMyAccount();
  i = JSON.parse(info);
  var psk = i.psk;
  var contactPskVersion = i.psk_version;
  try {
    const decrypted = await decryptMessage(psk, enc);
    $("#decmessage").val(decrypted);
  } catch (e) {}
});

$(".stopScan").on("click", function () {
  stopScan();
  $("#scanModal").hide();
});

//scan_qr_message
$("#scan_qr_message").on("click", function () {
  $("#decodeModal").hide();
  load_decode_qr();
});

//decodeMessageBtn
$("#decodeMessageBtn").on("click", function () {
  $("#decodeModal").show();
});

//close_QRModal
$("#close_QRModal").on("click", function () {
  $("#messageText").val("");
  $("#QRModal").hide();
});

$("#saveContact").on("click", function () {
  console.log("save_clivked");
  const name = $("#contactNameInput").val().trim();
  const key = $("#contactKeyInput").val().trim();
  const id = parseInt($("#contactID").val());

  if (!name || !key) {
    alert("Name and key are required");
    return;
  }

  console.log($("#contactID").val());
  console.log(id);
  if (id > 0) {
    console.log("update");

    //we have tocheck to see if the key changes

    AndroidDB.updateContact(id, name, key);
  } else {
    console.log("Create");
    AndroidDB.addContact(name, key);
  }

  $("#contactNameInput").val("");
  $("#contactKeyInput").val("");
  $("#contactID").val(""); //clear id if set
  load_contacts();
  gohome();
});

$("#closeContactModal").on("click", function () {
  gohome();
});

//scan_qr_key
$("#scan_qr_key").on("click", function () {
  $("#scanModal").show();
  readqr("contactKeyInput");
});

var last_keys = "";
$("#mykey").on("keydown", function () {
  last_keys = $(this).val();
  console.log(last_keys);
});

$("#edit_my_key").on("click", function () {
  //edit_my_key
  $("#mykey").removeClass("disabled");
});

$("#mykey").on("change", function () {
  bootbox.confirm({
    message:
      "This will wipe your existing key, you will have to share this new key to read new messages sent to you. All previous messages sent to you cannot be decrypted. <br> ARE YOU SURE YOU WANT TO DO THIS?",
    buttons: {
      confirm: {
        label: "Yes",
        className: "btn-danger",
      },
      cancel: {
        label: "No",
        className: "btn-success",
      },
    },
    callback: function (result) {
      console.log("This was logged in the callback: " + result);
      if (result == true) {
        const qrContainer = document.getElementById("myqrcode");
        renderqr_code(qrContainer, $("#mykey").val());
        $("#mykey").addClass("disabled");
      } else {
        $("#mykey").val(last_keys);
        $("#mykey").addClass("disabled");
      }
    },
  });
});

$("#save_account").on("click", function () {
  const myname = $("#myname").val();
  const mykey = $("#mykey").val();
  AndroidDB.saveMyAccount(myname, mykey);
  let info = AndroidDB.getCurrentMyAccount();
  gohome();
});

//delete_contact
$("#delete_contact").on("click", function () {
  const contact_id = parseInt($("#edit_contact").attr("data-id"));

  bootbox.confirm({
    message: "This will delete this contact and any messages you have with them, this cannot be undone. <br> ARE YOU SURE YOU WANT TO DO THIS?",
    buttons: {
      confirm: {
        label: "Yes",
        className: "btn-danger",
      },
      cancel: {
        label: "No",
        className: "btn-success",
      },
    },
    callback: function (result) {
      console.log("This was logged in the callback: " + result);
      if (result == true) {
        console.log("delete called");
        AndroidDB.deleteContact(contact_id);
        load_contacts();
        gohome();
      }
    },
  });
});

//scan_my_qr_key
$("#scan_my_qr_key").on("click", async function () {
  bootbox.confirm({
    message:
      "This will wipe your existing key, you will have to share this new key to read new messages sent to you. All previous messages sent to you cannot be decrypted. <br> ARE YOU SURE YOU WANT TO DO THIS?",
    buttons: {
      confirm: {
        label: "Yes",
        className: "btn-danger",
      },
      cancel: {
        label: "No",
        className: "btn-success",
      },
    },
    callback: function (result) {
      console.log("This was logged in the callback: " + result);
      if (result == true) {
        load_qr();
      }
    },
  });
});

function clear_contact() {
  $("#edit_contact").data("data-id", "");
  $("#edit_contact").data("data-psk", "");
  $("#edit_contact").data("data-name", "");
  $("#contactNameInput").val("");
  $("#contactKeyInput").val("");
  $("#contactID").val("");
}

async function load_qr() {
  $("#scanModal").show();
  try {
    const scannedKey = await readqr("mykey");
    if (scannedKey) {
      const qrContainer = document.getElementById("myqrcode");
      renderqr_code(qrContainer, scannedKey);
    }
  } catch (err) {
    console.error("QR scan failed:", err);
  }
}

async function load_decode_qr() {
  $("#scanModal").show();
  try {
    const scannedKey = await readqr("encmessage");
    $("#decodeModal").show();
  } catch (err) {
    console.error("QR scan failed:", err);
    $("#decodeModal").show();
  }
}

function renderqr_code(qrContainer, text) {
  console.log(qrContainer);
  console.log(text);
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: text,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
}

async function readqr(textloc) {
  if (scanning) return;
  scanning = true;
  lastScan = "";

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
    });

    video.srcObject = videoStream;
    await video.play();
    scanLoop_raw(textloc);
  } catch (err) {
    scanning = false;
    alert("Camera error: " + err);
  }
}

function scanLoop_raw(textloc) {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data !== lastScan) {
      lastScan = code.data;
      stopScan();
      $(`#${textloc}`).val(lastScan);
      $("#scanModal").hide();
      return;
    }
  }

  animationFrameId = requestAnimationFrame(() => scanLoop_raw(textloc));
}

//generate_key
$("#generate_key").on("click", function () {
  bootbox.confirm({
    message:
      "This will wipe your existing key, you will have to share this new key to read new messages sent to you. All previous messages sent to you cannot be decrypted. <br> ARE YOU SURE YOU WANT TO DO THIS?",
    buttons: {
      confirm: {
        label: "Yes",
        className: "btn-danger",
      },
      cancel: {
        label: "No",
        className: "btn-success",
      },
    },
    callback: function (result) {
      console.log("This was logged in the callback: " + result);
      if (result == true) {
        $("#mykey").val(generatePSK(8));
        if ($("#mykey").val()) {
          const qrContainer = document.getElementById("myqrcode");
          renderqr_code(qrContainer, $("#mykey").val());
        }
      }
    },
  });
});

$("#edit_contact").on("click", function () {
  const psk = $(this).attr("data-psk");
  const id = $(this).attr("data-id");
  const name = atob($(this).attr("data-name"));

  $("#contactNameInput").val(name);
  $("#contactKeyInput").val(psk);
  $("#contactID").val(id);

  $("#openAddContactPage").trigger("click");
});

$("#openAddContactPage").on("click", function () {
  console.log("trigger_page_show");
  $contactsPage.addClass("hidepage");
  $messagesPage.addClass("hidepage");
  $addMyAccount.addClass("hidepage");
  $addContactsPage.removeClass("hidepage");
  $addContactsPage.css("display", "flex");
});

$("#myaccount").on("click", function () {
  console.log("trigger_page_show");
  $contactsPage.addClass("hidepage");
  $messagesPage.addClass("hidepage");
  $addContactsPage.addClass("hidepage");
  $addMyAccount.removeClass("hidepage");
  $addMyAccount.css("display", "flex");

  let info = AndroidDB.getCurrentMyAccount();

  let i = [];
  try {
    i = JSON.parse(info);
    $("#myname").val(i.name);
    $("#mykey").val(i.psk);
  } catch (e) {
    console.error("Invalid JSON", e);
    i = [];
  }

  if (i.length === 0) {
    console.log("No account found");
    return;
  }

  if ($("#mykey").val()) {
    const qrContainer = document.getElementById("myqrcode");
    renderqr_code(qrContainer, $("#mykey").val());
  }
});
// Open conversation on click
$contactList.on("click", "li", function () {
  console.log("contact_show");
  const name = $(this).text();
  const psk = $(this).attr("data-psk");
  const id = parseInt($(this).attr("data-id"));

  getDecodedMessages(id).then((messages) => {
    renderChat(messages);
  });

  $("#edit_contact").attr("data-id", id);
  $("#edit_contact").attr("data-psk", psk);
  $("#edit_contact").attr("data-name", btoa(name));
  $activeContactName.text(name);
  $contactsPage.addClass("hidepage");
  $addMyAccount.addClass("hidepage");
  $messagesPage.removeClass("hidepage");

  $messagesPage.css("display", "flex");
});

// Back to contacts
$backBtn.on("click", function () {
  console.log("backclicked");
  gohome();
});

function gohome() {
  $messagesPage.addClass("hidepage");
  $addContactsPage.addClass("hidepage");
  $addMyAccount.addClass("hidepage");
  $contactsPage.removeClass("hidepage");
  $contactsPage.css("display", "flex");
  $("#decodeModal").hide();
  $("#scanModal").hide();
  $("#QRModal").hide();
  $("#scanModal").hide();
  clear_contact();
}

// Generates a secure PSK as a mnemonic
function generatePSK(numWords = 24) {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Secure random not available");
  }

  const words = [];
  for (let i = 0; i < numWords; i++) {
    // Generate a secure random index
    const array = new Uint16Array(1);
    window.crypto.getRandomValues(array);
    const idx = array[0] % wordlist.length;
    words.push(wordlist[idx]);
  }

  return words.join(" ");
}

function load_contacts() {
  $("#contactList").html("");
  let contactsJson = AndroidDB.getContacts();
  let contacts = [];
  try {
    contacts = JSON.parse(contactsJson);
  } catch (e) {
    console.error("Invalid contacts JSON", e);
    contacts = [];
  }

  if (contacts.length === 0) {
    console.log("No contacts found");
    return;
  }

  if (contacts.length > 0) {
    $.each(contacts, function (index, c) {
      console.log(c);
      var contacts = `<li class="list-group-item" data-id="${c.id}" data-psk="${c.psk}">${c.name}</li>`;
      $("#contactList").append(contacts);
    });
  }
}

async function getDecodedMessages(contactId) {
  // 1️⃣ Fetch raw messages for the contact
  const messagesJSON = AndroidDB.getMessagesForContact(contactId);
  const messages = JSON.parse(messagesJSON);

  console.log(messagesJSON);
  console.log(messages);

  const decodedMessages = [];

  for (const msg of messages) {
    let psk;

    try {
      if (msg.direction === "inbound") {
        // Message sent TO me → use my PSK for the exact version
        psk = AndroidDB.getMyPskByVersion(msg.psk_version);
      } else {
        // Message sent BY me → use contact's PSK for the exact version
        psk = AndroidDB.getContactPskByVersion(msg.contact_id, msg.psk_version);
      }

      if (!psk) {
        // Could not find PSK for version
        decodedMessages.push({ ...msg, plaintext: "[psk missing]" });
        console.warn("Missing PSK for message id", msg.id, "version", msg.psk_version);
        continue;
      }

      // 2️⃣ Decrypt using the correct PSK
      const plaintext = await decryptMessage(psk, msg.ciphertext);

      decodedMessages.push({ ...msg, plaintext });
    } catch (e) {
      console.error("Failed to decrypt message id", msg.id, e);
      decodedMessages.push({ ...msg, plaintext: "[decryption failed]" });
    }
  }

  // 3️⃣ Return array of messages with plaintext included
  return decodedMessages;
}

function renderChat(messages) {
  const $container = $("#messageList");
  $container.empty();

  messages.forEach((msg) => {
    const side = msg.direction === "inbound" ? "inbound" : "outbound";

    const $row = $("<div>").addClass("chat-row").addClass(side);

    const $bubble = $("<div>").addClass("chat-bubble mb-3");

    const $name = $("<div>")
      .addClass("chat-name")
      .text(msg.contact_name || "");

    const $text = $("<div>").addClass("chat-text").text(msg.plaintext);

    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const $time = $("<div>").addClass("chat-time").text(time);

    $bubble.append($text, $time);
    $row.append($bubble);
    $container.append($row);
  });

  $container.scrollTop($container[0].scrollHeight);
}

async function generateQRCode() {
  const contactId = parseInt(sendContactSelect.value);
  const text = messageText.value.trim();

  if (!text) {
    alert("Enter a message first");
    return;
  }

  if (isNaN(contactId)) {
    alert("Select a contact");
    return;
  }

  // Get the contact's PSK from AndroidDB
  const contacts = JSON.parse(AndroidDB.getContacts());
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) {
    alert("Contact not found!");
    return;
  }

  const encrypted = await encryptMessage(contact.psk, text);

  // Save encrypted message as outbound
  AndroidDB.addMessage(contactId, "outbound", encrypted, Date.now());
  renderMessages();

  // Generate QR code with encrypted text
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: encrypted,
    width: 256,
    height: 256,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });

  alert("Encrypted QR generated!");
  messageText.value = "";
}

// ========================= QR Scanning =========================
async function startScan() {
  if (scanning) return;
  scanning = true;
  lastScan = "";

  const contactId = parseInt(scanContactSelect.value);
  if (isNaN(contactId)) {
    alert("Select a contact to save scanned messages");
    scanning = false;
    return;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    video.srcObject = videoStream;
    scanLoop(contactId);
  } catch (err) {
    alert("Camera error: " + err);
  }
}

function scanLoop(contactId) {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data !== lastScan) {
      lastScan = code.data;
      result.textContent = "QR: " + code.data;

      stopScan();

      // Save message to selected contact
      //   setTimeout(() => {
      //       AndroidDB.addMessage(contactId, "inbound", code.data, Date.now());
      //       renderMessages();
      //       alert("Message saved!");
      //   }, 100);
      const contacts = JSON.parse(AndroidDB.getContacts());
      const contact = contacts.find((c) => c.id === contactId);

      if (!contact) {
        alert("Selected contact not found");
        return;
      }

      // Decrypt inbound message
      decryptMessage(contact.psk, code.data)
        .then((decrypted) => {
          // Save decrypted message as inbound
          AndroidDB.addMessage(contactId, "inbound", decrypted, Date.now());
          renderMessages();
          alert("Message decrypted and saved!");
        })
        .catch((err) => {
          alert("Decryption failed: " + err);
          console.error(err);
        });
    }
  }

  animationFrameId = requestAnimationFrame(() => scanLoop(contactId));
}

function stopScan() {
  scanning = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }
}

# 📸 Photo Storage Web App

A standalone public photo-upload website. Visitors can upload photos, everyone can see the gallery, and the website displays live filesystem storage information.

## What it does

- Anyone with the URL can upload photos.
- Photos are saved directly to the configured Android SD-card folder.
- Everyone can view the shared gallery.
- Storage status shows total/used/free disk space when supported by Node.js.
- JPG, JPEG, PNG, WEBP and GIF are accepted.
- Maximum 10 MB per photo.
- Maximum 10 photos per upload.
- Basic rate limiting is enabled.
- Uploaded files get randomized server-side names.
- No delete button is exposed publicly.

## Important

A browser cannot directly save a visitor's upload into your phone's SD card.

You need to run the Node.js backend on the Android phone/device that has the SD card. The public website talks to that backend.

Do NOT expose a raw Node.js port to the internet without HTTPS and protection.

---

# Android + Termux setup

## 1. Install Termux

Use a current Termux build from a trusted source such as F-Droid or the official Termux GitHub project.

## 2. Give Termux storage permission

Run:

```bash
termux-setup-storage
```

Allow the permission.

## 3. Install Node.js

```bash
pkg update
pkg install nodejs
```

Check:

```bash
node -v
npm -v
```

## 4. Find your SD-card ID

Run:

```bash
ls /storage
```

You may see something like:

```text
emulated
self
1234-ABCD
```

`1234-ABCD` is an example SD-card ID.

## 5. Put this project somewhere in Termux

For example:

```bash
mkdir -p ~/photo-storage
cd ~/photo-storage
```

Copy/extract the project there.

## 6. Configure the SD-card path

Open `server.js` and find:

```js
const PHOTO_DIR =
  process.env.PHOTO_DIR || "/storage/XXXX-XXXX/PhotoStorage";
```

Replace `XXXX-XXXX`.

Example:

```js
const PHOTO_DIR =
  process.env.PHOTO_DIR || "/storage/1234-ABCD/PhotoStorage";
```

You can also set it without editing the code:

```bash
export PHOTO_DIR="/storage/1234-ABCD/PhotoStorage"
```

## 7. Install dependencies

Inside the project:

```bash
npm install
```

## 8. Start the server

```bash
node server.js
```

You should see the server running on port 3000.

Open on the phone:

```text
http://127.0.0.1:3000
```

---

# Test from another device on the same Wi-Fi

Find the phone's local IP:

```bash
ip addr show wlan0
```

Look for an address such as:

```text
192.168.1.20
```

Then another phone on the same Wi-Fi can open:

```text
http://192.168.1.20:3000
```

---

# Make it available on the internet

For a public internet URL, use a secure tunnel instead of exposing port 3000 directly.

One practical option is Cloudflare Tunnel.

The basic idea is:

```text
Internet
   ↓
HTTPS public URL
   ↓
Secure tunnel
   ↓
Android phone
   ↓
Node.js
   ↓
SD card
```

Keep the Node server bound to the local device and let the tunnel provide HTTPS.

---

# Security warning

This project is intentionally an open upload service.

If you give the URL to anyone on the internet, strangers can upload files.

Before using it as a serious public service, add:

- upload authentication or invite code
- daily/hourly per-IP limits
- total storage quota
- maximum total number of files
- admin dashboard
- delete/report controls
- abuse protection
- image-content validation
- malware/content scanning where appropriate
- HTTPS
- backups
- logging and cleanup
- Terms/Privacy notice if operating publicly

A public anonymous upload server can be abused very quickly, so do not rely on the SD card alone as your only copy of important photos.

## SD-card limitation

Android may restrict background processes. If the phone sleeps, Termux is killed, the SD card is removed, or the phone loses internet, the website will be unavailable.

For a small personal/public experiment this can work. For a production service, use proper server/object storage.

---

# API endpoints

### Get gallery

```text
GET /api/photos
```

### Get storage information

```text
GET /api/storage
```

### Upload photos

```text
POST /api/upload
```

Form field:

```text
photos
```

### View a photo

```text
GET /photos/<filename>
```

---

# Changing limits

In `server.js`:

```js
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES_PER_UPLOAD = 10;
```

Increase/decrease these according to your SD card and network.

For example, 5 MB photos:

```js
const MAX_FILE_SIZE_MB = 5;
```

Restart Node.js after changing the settings.

---

# Stopping the server

Press:

```text
CTRL + C
```

in Termux.

---

# Important production note

This project does not implement user accounts. Every visitor shares the same gallery.

That is intentional for the simple "anyone can upload and everyone can see" use case.

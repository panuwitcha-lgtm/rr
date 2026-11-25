// copy ไฟล์นี้เป็น secrets.h (ไฟล์อยู่โฟลเดอร์เดียวกัน) แล้วใส่ค่าจริง
// secrets.h ไม่ถูกอัปขึ้น GitHub (อยู่ใน .gitignore)
#pragma once
#define WIFI_SSID     "your-wifi-name"              // ต้องเป็น Wi-Fi 2.4 GHz
#define WIFI_PASSWORD "your-wifi-password"
#define TB_TOKEN      "PUT_YOUR_ACCESS_TOKEN_HERE"  // ThingsBoard → Devices → Health Chair → Copy access token

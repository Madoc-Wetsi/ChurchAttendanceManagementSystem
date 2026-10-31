/* ============================================================
   ChurchAttendance — configuration
   ------------------------------------------------------------
   This is the ONLY file you need to touch to switch the app
   between "demo mode" (this browser's storage) and "real
   database mode" (your PHP + MySQL).

   apiBase:  ""                  -> demo mode. Everything is kept
                                    in this browser's localStorage.
                                    Nothing is sent anywhere.

           :  "api"             -> database mode. The app talks to
                                    api/index.php in this folder.

           :  "https://yourhost/church/api"
                                  -> database mode on a server whose
                                    API lives somewhere else.

   Everything else (photo uploads, limits, debugging) is set in
   api/config.php on the PHP side.
   ============================================================ */
window.CHURCH_CONFIG = {
  apiBase: "api",
};

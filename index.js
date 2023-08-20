const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const socks = require("socksv5");
const { Client } = require("ssh2");
const { exec } = require("child_process");
const Store = require("electron-store");
const regedit = require("regedit");
regedit.setExternalVBSLocation("resources/regedit/vbs");



const localProxy = {
  host: "localhost",
  port: 19000,
};

// * SAVING USER SETTING
const store = new Store();

let sshConfig = {
  host: "",
  port: 2,
  username: "",
  password: "",
};




class sshTunnel {
  static server;

  static async widesystem() {
    const keyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      
      try {
        await regedit.promisified.putValue({
        [keyPath]: {
          ProxyEnable: {
            value: 1,
            type: "REG_DWORD",
          },
          ProxyServer: {
            value: "socks5://localhost:19000",
            type: "REG_SZ",
          },
          ProxyOverride: {
            value: "localhost;127.0.0.1",
            type: "REG_SZ",
          },
        },
      });
      console.log("Registry values set on successfully");
    } catch (error) {
      console.error("Error setting registry values:", error);
    }
  }

  static async localsystem() {
    const keyPath =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";

    try {
      await regedit.promisified.putValue({
        [keyPath]: {
          ProxyEnable: {
            value: 0,
            type: "REG_DWORD",
          },
        },
      });
      console.log("Registry values set off successfully");
    } catch (error) {
      console.error("Error setting registry values:", error);
    }
  }
  static deny(err) {
      if (err && err.code === "ECONNRESET") {
        console.log("ECONNRESET error occurred");
      } else {
        // Handle other errors or the original deny logic
      }
    }

  static ssh() {
    try {
      socks
        .createServer((info, accept, deny) => {
          const conn = new Client();
          conn
            .on("ready", () => {
              conn.forwardOut(
                info.srcAddr,
                info.srcPort,
                info.dstAddr,
                info.dstPort,
                (err, stream) => {
                  if (err) {
                    conn.end();
                    return deny(err);
                  }
                  const clientSocket = accept(true);
                  if (clientSocket) {
                    stream
                      .pipe(clientSocket)
                      .pipe(stream)
                      .on("close", () => {
                        conn.end();
                      });
                  } else {
                    conn.end();
                  }
                }
              );
            })
            .on("error", (err) => {
              deny(err);
            })
            .connect(sshConfig);
        })
        .listen(localProxy.port, "localhost")
        .useAuth(socks.auth.None());
    } catch (err) {
      if (err.code == "ECONNRESET") {
        console.log("ECONNRESET error occurred");
      } else if (err.message == "Connection lost before handshake") {
        console.log(
          "Connection lost before handshake error occurred fuuuuuuuuuuuuuuuuuuuuuuck"
        );
      }
    }
  }

  static closeconnection() {
    // Stop the SOCKS5 server
    this.server.close();

    // Close the SSH connection
    this.conn.end();
  }

  static Browsing() {
    const command = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="%USERPROFILE%\\proxy-profile" --proxy-server="socks5://localhost:19000"`;

    exec(command);
  }
}
// ? done of declerfiaction





let win;
let isMaximized = false;
let isWideSystem = 0; // 1 == on , 0 == off
sshTunnel.ssh();

function createWindow() {
  win = new BrowserWindow({
    width: 370,
    height: 700,
    icon: "assets/logo1.png",
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: true,
      useContentSize: true,
    },
  });
  win.loadFile("index.html");
  win.webContents.openDevTools();
}

// read ECONNRESET
// ! SSH CONFIGURATION
ipcMain.on("make-ssh-tunnel", async (event, args) => {
  if (args == 1) {
    if (sshConfig.port == 2) {
      alert("fuck no")
      // CODE FOR ERROR OF USER HANDELING, no input have been set from user and sshConfig is not set by Store class
    } else {
      sshTunnel
        .widesystem()
        .then(() => {
          event.returnValue = 0;
        })
        .catch(() => {
          event.returnValue = 1;
        });
      isWideSystem = 1;
    }
  } else if (args == 0) {
    sshTunnel.localsystem();
    isWideSystem = 0;
  }
});

// * USER INPUT VALIFATION
ipcMain.on("cred", (event, ip, port, username, password) => {
  if (ip === '') {
    console.log("the input is empty") // MAYBE WE SHOLD HANDLE THIS IN FRONT
    // VALIDATE FOR ALL INPUTS : IP PORT USERNAME , PASSWORD
  } else {
    try {
      store.set({
        sshconfig: {
          sship: ip,
          sshport: port,
          sshusername: username,
          sshpassword: password,
        },
      });

      console.log(store.get("sshconfig.sship"));
    } catch (err) {
      console.log("ERROR while setting ip");
    }
  }
})


ipcMain.handle("open-browser", () => {
  sshTunnel.Browsing();
});
// ! SSH CONFIGURATION






// ! window integration
ipcMain.handle("minimize", async () => {
  win.minimize();
});

ipcMain.handle("maximize", () => {
  if (isMaximized) {
    win.setSize(370, 700);
    win.center();
    isMaximized = false;
  } else {
    win.maximize();
    isMaximized = true;
  }
});

ipcMain.on("close", () => {
  if (isWideSystem == 1) {
    sshTunnel.localsystem().then(() => {
      app.quit();
    });
  } else {
    app.quit();
  }
});

// ! Closing app
app.whenReady().then(async () => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

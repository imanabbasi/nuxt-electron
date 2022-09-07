const { app, BrowserWindow, screen, shell } = require("electron");
const serve = require("electron-serve");
const Store = require("electron-store");
const path = require('path')

const createWindow = (windowName, options) => {
	const key = "window-state";
	const name = `window-state-${windowName}`;
	const store = new Store({ name });
	const defaultSize = {
		width: options.width,
		height: options.height,
	};
	let state = {};
	let win;

	const restore = () => store.get(key, defaultSize);

	const getCurrentPosition = () => {
		const position = win.getPosition();
		const size = win.getSize();
		return {
			x: position[0],
			y: position[1],
			width: size[0],
			height: size[1],
		};
	};

	const windowWithinBounds = (windowState, bounds) => {
		return (
			windowState.x >= bounds.x &&
			windowState.y >= bounds.y &&
			windowState.x + windowState.width <= bounds.x + bounds.width &&
			windowState.y + windowState.height <= bounds.y + bounds.height
		);
	};

	const resetToDefaults = () => {
		const bounds = screen.getPrimaryDisplay().bounds;
		return Object.assign({}, defaultSize, {
			x: (bounds.width - defaultSize.width) / 2,
			y: (bounds.height - defaultSize.height) / 2,
		});
	};

	const ensureVisibleOnSomeDisplay = (windowState) => {
		const visible = screen.getAllDisplays().some((display) => {
			return windowWithinBounds(windowState, display.bounds);
		});
		if (!visible) {
			// Window is partially or fully not visible now.
			// Reset it to safe defaults.
			return resetToDefaults();
		}
		return windowState;
	};

	const saveState = () => {
		Object.assign(state, getCurrentPosition());
		store.set(key, state);
	};

	const handleNavigate = (e, url) => {
		if (url !== e.sender.getURL()) {
			e.preventDefault();
			shell.openExternal(url);
		}
	};

	state = ensureVisibleOnSomeDisplay(restore());

	win = new BrowserWindow({
		...options,
		...state,
		webPreferences: {
			nodeIntegration: true,
			preload: path.join(__dirname, 'preload.js')
		},
	});

	win.on("maximize", saveState);
	win.on("unmaximize", saveState);
	win.on("resize", saveState);
	win.on("move", saveState);
	win.on("close", saveState);
	win.webContents.on("will-navigate", handleNavigate);
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});

	return win;
};

const loadURL = serve({ directory: "dist" });
(async () => {
	await app.whenReady();
	mainWindow = createWindow("main", {
		width: 1000,
		height: 600,
	});
	if (app.isPackaged) {
		await loadURL(mainWindow);
	} else {
		await mainWindow.loadURL("http://localhost:3000");
		await mainWindow.webContents.openDevTools();
	}
})();

app.on("window-all-closed", () => {
	app.quit();
});

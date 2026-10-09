const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

function readEnvironmentValue(...names) {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    return "";
}

const configuration = {
    apiKey: readEnvironmentValue("DIMMAKO_FIREBASE_API_KEY"),
    authDomain: readEnvironmentValue("DIMMAKO_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnvironmentValue("DIMMAKO_FIREBASE_PROJECT_ID", "ID_DO_PROJETO_FIREBASE_DIMMAKO"),
    storageBucket: readEnvironmentValue("DIMMAKO_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnvironmentValue("DIMMAKO_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnvironmentValue("DIMMAKO_FIREBASE_APP_ID", "ID_DO_APLICATIVO_FIREBASE_DIMMAKO"),
    measurementId: readEnvironmentValue("DIMMAKO_FIREBASE_MEASUREMENT_ID"),
    appCheckSiteKey: readEnvironmentValue("DIMMAKO_FIREBASE_APPCHECK_SITE_KEY"),
    arcgisApiKey: readEnvironmentValue("DIMMAKO_ARCGIS_API_KEY"),
    imgbbApiKey: readEnvironmentValue("DIMMAKO_IMGBB_API_KEY")
};

const requiredVariables = [
    ["apiKey", "DIMMAKO_FIREBASE_API_KEY"],
    ["authDomain", "DIMMAKO_FIREBASE_AUTH_DOMAIN"],
    ["projectId", "DIMMAKO_FIREBASE_PROJECT_ID"],
    ["appId", "DIMMAKO_FIREBASE_APP_ID"],
    ["imgbbApiKey", "DIMMAKO_IMGBB_API_KEY"]
];
const missingVariables = requiredVariables
    .filter(([key]) => !configuration[key].trim())
    .map(([key, variable]) => {
        if (key === "projectId") return `${variable} (or ID_DO_PROJETO_FIREBASE_DIMMAKO)`;
        if (key === "appId") return `${variable} (or ID_DO_APLICATIVO_FIREBASE_DIMMAKO)`;
        return variable;
    });

if (missingVariables.length) {
    console.error(`Vercel build stopped: configure these required environment variables: ${missingVariables.join(", ")}.`);
    process.exit(1);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyDirectory(source, destination, accepts) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(sourcePath, destinationPath, accepts);
        } else if (entry.isFile() && accepts(entry.name)) {
            fs.copyFileSync(sourcePath, destinationPath);
        }
    }
}

for (const file of ["index.html", "home.html", "hero-truck.jpg", "dimako-icone-laranja.png"]) {
    fs.copyFileSync(path.join(root, file), path.join(output, file));
}

copyDirectory(
    path.join(root, "styles"),
    path.join(output, "styles"),
    name => name.endsWith(".css")
);
copyDirectory(
    path.join(root, "assets"),
    path.join(output, "assets"),
    () => true
);
copyDirectory(
    path.join(root, "src", "js"),
    path.join(output, "src", "js"),
    name => name.endsWith(".js") && name !== "firebase-config.js"
);

const configPath = path.join(output, "src", "js", "firebase-config.js");
const configSource = `window.__DIMMAKO_FIREBASE_CONFIG__ = Object.freeze(${JSON.stringify(configuration, null, 2)});\n`;
fs.writeFileSync(configPath, configSource, { encoding: "utf8", flag: "wx" });

console.log("Vercel static site built with Firebase configuration from environment variables.");

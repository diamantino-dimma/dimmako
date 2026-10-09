(() => {
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    async function signatureIsValid(file) {
        if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
            return false;
        }

        const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        const startsWith = values => values.every((value, index) => bytes[index] === value);
        if (file.type === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
        if (file.type === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        if (file.type === "image/gif") return /^GIF8[79]a$/.test(String.fromCharCode(...bytes.slice(0, 6)));
        return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
            && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    }

    async function uploadToImgBB(file) {
        if (!await signatureIsValid(file)) {
            throw new Error("Escolha uma imagem JPG, PNG, WebP ou GIF válida, até 10 MB.");
        }

        const apiKey = window.__DIMMAKO_FIREBASE_CONFIG__?.imgbbApiKey;
        if (!apiKey) throw new Error("A chave do ImgBB não está configurada.");

        const body = new FormData();
        body.append("image", file);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            body
        });
        const result = await response.json();
        const imageUrl = result?.data?.image?.url || result?.data?.url;
        if (!response.ok || !result?.success || typeof imageUrl !== "string") {
            throw new Error(result?.error?.message || `O ImgBB recusou o envio (HTTP ${response.status}).`);
        }

        const parsedUrl = new URL(imageUrl);
        if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "i.ibb.co"
            || parsedUrl.port || parsedUrl.username || parsedUrl.password || parsedUrl.pathname.length < 2) {
            throw new Error("O ImgBB devolveu uma URL de imagem inesperada.");
        }
        return parsedUrl.href;
    }

    function isImgBBUrl(value) {
        if (typeof value !== "string") return false;
        try {
            const url = new URL(value);
            return url.protocol === "https:"
                && url.hostname === "i.ibb.co"
                && !url.port
                && !url.username
                && !url.password
                && url.pathname.length >= 2;
        } catch (error) {
            return false;
        }
    }

    window.dimmakoMedia = Object.freeze({ signatureIsValid, isImgBBUrl, uploadToImgBB });
})();

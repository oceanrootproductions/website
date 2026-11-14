const validSave = (s) => {
    if (!s)
        return false;
    try {
        const j = JSON.parse(s);
        return !!j && typeof j === "object" && "data" in j;
    }
    catch {
        return false;
    }
};
export function chooseSave(cloud, local, cloudReachable) {
    if (validSave(cloud))
        return { json: cloud, source: "cloud", migrate: false };
    if (validSave(local))
        return { json: local, source: "local", migrate: cloudReachable };
    return { json: null, source: "fresh", migrate: false };
}

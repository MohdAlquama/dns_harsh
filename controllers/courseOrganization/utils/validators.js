const ALLOWED_STORAGE_TYPES = new Set(['s3', 's3_cdn']);

export const isValidStorageType = (type) => {
    return ALLOWED_STORAGE_TYPES.has(type);
};

export const isValidUrl = (urlStr) => {
    try {
        new URL(urlStr);
        return true;
    } catch (err) {
        return false;
    }
};

export const isNotEmpty = (val) => {
    return typeof val === 'string' && val.trim().length > 0;
};
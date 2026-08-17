import jwt from "jsonwebtoken";


const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "DNS_ACCESS_TOKEN_SECRET_2026";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "DNS_REFRESH_TOKEN_SECRET_2026";

if (process.env.NODE_ENV === "production" &&
    (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET)) {
    throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET are required in production");
}


const createAccessToken = (userId) => {

    return jwt.sign(
        {
            userId
        },
        ACCESS_TOKEN_SECRET,
        {
            expiresIn: "15m"
        }
    );
};


const createRefreshToken = (userId) => {

    return jwt.sign(
        {
            userId
        },
        REFRESH_TOKEN_SECRET,
        {
            expiresIn: "30d"
        }
    );
};


const verifyRefreshToken = (token) => {

    return jwt.verify(
        token,
        REFRESH_TOKEN_SECRET
    );
};


export {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken
};

import Cookies from "js-cookie";
import CryptoJS from "crypto-js";
import api from "../lib/api";

export const login = async (ID, PWD) => {
  const response = await api.post("/user/login", { ID, PWD });
  return response.data;
};

export const getUserAutoLogin = async ({ iv, jwt }) => {
  try {
    // 自動登入時清除原本登入資訊
    Object.keys(Cookies.get()).forEach((cookieName) => {
      Cookies.remove(cookieName);
    });

    const key = CryptoJS.enc.Utf8.parse(
      "mnU5ioB8UlFYvLudLBEvYuNpTFS7jnBk"
    );

    const toBase64 = (value) => {
      let result = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      while (result.length % 4 !== 0) {
        result += "=";
      }

      return result;
    };

    const parsedIv = CryptoJS.enc.Base64.parse(
      toBase64(iv)
    );

    const cipherText = CryptoJS.enc.Base64.parse(
      toBase64(jwt)
    );

    const decrypted = CryptoJS.AES.decrypt(
      {
        ciphertext: cipherText,
      },
      key,
      {
        iv: parsedIv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC,
      }
    );

    const token = decrypted.toString(
      CryptoJS.enc.Utf8
    );

    if (!token) {
      throw new Error("自動登入 Token 解密失敗");
    }

    const response = await api.post(
      "/user/autologin",
      "",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Auto login failed:", error);
    throw error;
  }
};

export const getUserPages = async () => {
  const response = await api.post("/user/pages");
  return response.data.data;
};

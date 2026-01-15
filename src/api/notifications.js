import axios from "axios";

const API_URL =
  "https://us-central1-agapay-capstone.cloudfunctions.net/sendSingleMessage";

export const sendSingleNotification = (token, message) => {
  return axios.post(API_URL, {
    title: "AGAPAY",
    body: message,
    token: token,
  });
};

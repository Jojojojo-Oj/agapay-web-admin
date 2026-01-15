const notificationServices = require ("../service/notificationService");

const sendFirebaseNotifcation = async (req, res) =>{
    try {
        const {title,body, deviceToken } = req.body;
        notificationServices.sendNotification(deviceToken, title, body);
        res.status(200).json({message: "Notification Sent Successfully", sucess: true})
    }catch(error) {
        res.status(500).json({message: "Error sending notification", sucess: false})
    }
}
module.exports = sendFirebaseNotifcation;
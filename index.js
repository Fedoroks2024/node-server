const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(bodyParser.json());
app.use(cors());

const users = [
    { login: "user1", password: "pass1", direction: "programming", state: false },
    { login: "user2", password: "pass2", direction: "3d_modeling", state: false },
    { login: "user3", password: "pass3", direction: "journalism", state: false },
];
let loggedInUsers = {}; // Хранение токенов и направлений

// Функция для генерации токена
function generateToken(login) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 30; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `${login}-${token}`;
  }


// Авторизация
app.post("/auth", (req, res) => {
    const { login, password } = req.body;
    const user = users.find((u) => u.login === login && u.password === password);
    if (user) {
        const token = generateToken(login);
        loggedInUsers[token] = { login, direction: user.direction };
        return res.json({ success: true, token, direction: user.direction });
    }
    res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// Проверка токена
app.post("/verify-token", (req, res) => {
    const { token } = req.body;
    if (loggedInUsers[token]) {
        const { direction } = loggedInUsers[token];
        return res.json({ success: true, direction });
    }
    res.status(401).json({ success: false });
});

// Обновление состояния (нажатие кнопки)
app.post("/update-state", (req, res) => {
    const { token } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);
    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        targetUser.state = true;
        // Обновляем состояние
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: "Ошибка обновления состояния" });
});

// Получение состояния для отображения картинки
app.post("/get-state", (req, res) => {
    const { token } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);
    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        return res.json({ success: true, state: targetUser.state });
    }
    res.status(400).json({ success: false, message: "Ошибка получения состояния" });
});

// Выход из аккаунта
app.post("/logout", (req, res) => {
    const { token } = req.body;
    if (loggedInUsers[token]) {
        delete loggedInUsers[token];
        return res.json({ success: true });
    }
    res.status(400).json({ success: false });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
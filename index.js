const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Redis Configuration - REMOVED
// const redis = require("redis");
// const redisClient = redis.createClient({
//     socket: {
//         host: "frankfurt-redis.render.com",
//         port: 6379,
//     },
//     username: "red-cte0dn5ds78s739gmarg",
//     password: "KtpriKoBKsOPgZy5J2SwEi6KfG9LEeic"
// });

// redisClient.on('error', err => console.log('Redis Client Error', err));

// (async () => {
//     try {
//         await redisClient.connect();
//         console.log("Redis client connected successfully");
//     } catch (error) {
//          console.error("Redis connection failed:", error)
//     }

// })();

const users = [];
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

// Функция для выбора случайной картинки профиля
function getRandomProfilePicture(direction) {
    const profilePictures = {
        programming: [
            "https://api.memory.mts.ru/api/1.0/preview/link/content/_gS0oZvT7E-ehq_BtWUpDA?type=image",
            "https://api.memory.mts.ru/api/1.0/preview/link/content/he7vcXc5-ZkOKOIhO0Ardwg?type=image",
            "https://example.com/programming3.png",
        ],
        "3d_modeling": [
            "https://example.com/3dmodeling1.png",
            "https://example.com/3dmodeling2.png",
            "https://example.com/3dmodeling3.png",
        ],
        journalism: [
            "https://example.com/journalism1.png",
            "https://example.com/journalism2.png",
            "https://example.com/journalism3.png",
        ]
    }
    const picturesForDirection = profilePictures[direction] || ["https://example.com/default.png"]; // Если нет картинок для направления, берем default
    return picturesForDirection[Math.floor(Math.random() * picturesForDirection.length)]
}

// Загрузка пользователей из Redis при запуске сервера - REMOVED
// async function loadUsersFromRedis() {
//     try {
//         const keys = await redisClient.keys('user:*');
//         for (const key of keys) {
//            const userString = await redisClient.get(key);
//            const user = JSON.parse(userString);
//            if (user) {
//                users.push(user);
//            }
//         }
//          console.log('Users loaded from Redis:', users);
//     } catch (error) {
//         console.error("Failed to load users from Redis:", error);
//     }
// }

// loadUsersFromRedis();

// Сохранение пользователя в Redis - REMOVED
// async function saveUserToRedis(user) {
//     try {
//       await redisClient.set(`user:${user.login}`, JSON.stringify(user));
//       console.log(`User ${user.login} saved to Redis`);
//     } catch (error) {
//       console.error(`Failed to save user ${user.login} to Redis:`, error);
//     }
// }


// Регистрация
app.post("/register", async (req, res) => {
    const { login, password, direction } = req.body;

    // Проверяем, существует ли пользователь с таким логином
    const existingUser = users.find(user => user.login === login);
    if (existingUser) {
        return res.status(400).json({ success: false, message: "Пользователь с таким логином уже существует" });
    }

    // Генерируем ссылку на картинку профиля
    const profilePicture = getRandomProfilePicture(direction);


    // Создаем нового пользователя и добавляем его в массив
    const newUser = { login, password, direction, state: false, profilePicture, interests: [], name: "", history: [] };
    users.push(newUser);

    // Сохранение пользователя в Redis - REMOVED
    // await saveUserToRedis(newUser);
    // Генерируем токен для нового пользователя и сохраняем его в loggedInUsers
    const token = generateToken(login);
    loggedInUsers[token] = { login, direction };

    res.status(201).json({ success: true, token, direction, profilePicture, message: "Регистрация прошла успешно" });
});

// Авторизация
app.post("/auth", async (req, res) => {
    const { login, password } = req.body;
    const user = users.find((u) => u.login === login && u.password === password);
    if (user) {
        const token = generateToken(login);
        loggedInUsers[token] = { login, direction: user.direction };
        return res.json({ success: true, token, direction: user.direction, profilePicture: user.profilePicture, interests: user.interests, name: user.name, history: user.history });
    }
    res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// Проверка токена
app.post("/verify-token", (req, res) => {
    const { token } = req.body;
    if (loggedInUsers[token]) {
        const { direction, login } = loggedInUsers[token];
        const user = users.find(u => u.login === login);
        return res.json({ success: true, direction, profilePicture: user.profilePicture, interests: user.interests, name: user.name, history: user.history });
    }
    res.status(401).json({ success: false });
});

// Обновление состояния (нажатие кнопки)
app.post("/update-state", async (req, res) => {
    const { token } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);
    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        targetUser.state = true;
        // await saveUserToRedis(targetUser); - REMOVED
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

// Сохранение интересов
app.post("/save-interests", async (req, res) => {
    const { token, interests } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);

    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        targetUser.interests = interests;
        // await saveUserToRedis(targetUser); - REMOVED
        return res.json({ success: true, message: "Интересы успешно сохранены" });
    }
    res.status(400).json({ success: false, message: "Ошибка сохранения интересов" });
});

// Сохранение имени
app.post("/save-name", async (req, res) => {
    const { token, name } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);

    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        targetUser.name = name;
        // await saveUserToRedis(targetUser); - REMOVED
        return res.json({ success: true, message: "Имя успешно сохранено" });
    }
    res.status(400).json({ success: false, message: "Ошибка сохранения имени" });
});


// Сохранение истории
app.post("/save-history", async (req, res) => {
    const { token, historyItem } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);

    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        targetUser.history.push(historyItem);
         // await saveUserToRedis(targetUser); - REMOVED
        return res.json({ success: true, message: "История успешно сохранена" });
    }
    res.status(400).json({ success: false, message: "Ошибка сохранения истории" });
});

// Получение истории
app.post("/get-history", (req, res) => {
    const { token } = req.body;
    const user = Object.values(loggedInUsers).find((u) => u.login === loggedInUsers[token]?.login);

    if (user) {
        const targetUser = users.find((u) => u.login === user.login);
        return res.json({ success: true, history: targetUser.history });
    }
    res.status(400).json({ success: false, message: "Ошибка получения истории" });
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
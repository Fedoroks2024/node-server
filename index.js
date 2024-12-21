const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(bodyParser.json());
app.use(cors());

const users = [
  { login: "user1", password: "pass1", direction: "programming", state: false, profilePicture: "" },
  { login: "user2", password: "pass2", direction: "3d_modeling", state: false, profilePicture: "" },
  { login: "user3", password: "pass3", direction: "journalism", state: false, profilePicture: "" },
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

// Функция для выбора случайной картинки профиля
function getRandomProfilePicture(direction) {
    const profilePictures = {
        programming: [
            "https://example.com/programming1.png",
            "https://example.com/programming2.png",
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


// Регистрация
app.post("/register", (req, res) => {
  const { login, password, direction } = req.body;

  // Проверяем, существует ли пользователь с таким логином
  const existingUser = users.find(user => user.login === login);
  if (existingUser) {
    return res.status(400).json({ success: false, message: "Пользователь с таким логином уже существует" });
  }

  // Генерируем ссылку на картинку профиля
  const profilePicture = getRandomProfilePicture(direction);


  // Создаем нового пользователя и добавляем его в массив
  const newUser = { login, password, direction, state: false, profilePicture };
  users.push(newUser);

  // Генерируем токен для нового пользователя и сохраняем его в loggedInUsers
  const token = generateToken(login);
  loggedInUsers[token] = { login, direction };

  res.status(201).json({ success: true, token, direction, profilePicture, message: "Регистрация прошла успешно" });
});

// Авторизация
app.post("/auth", (req, res) => {
  const { login, password } = req.body;
  const user = users.find((u) => u.login === login && u.password === password);
  if (user) {
    const token = generateToken(login);
      loggedInUsers[token] = { login, direction: user.direction };
    return res.json({ success: true, token, direction: user.direction, profilePicture: user.profilePicture });
  }
  res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

// Проверка токена
app.post("/verify-token", (req, res) => {
  const { token } = req.body;
    if (loggedInUsers[token]) {
        const { direction, login } = loggedInUsers[token];
        const user = users.find(u => u.login === login);
        return res.json({ success: true, direction, profilePicture: user.profilePicture });
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
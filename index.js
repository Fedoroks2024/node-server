const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const redis = require("redis");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const redisClient = redis.createClient({
  url: "rediss://red-ctk3smqj1k6c73cmgmi0:vshRWsw12Wx9kDdJYye4Uq7gIjjwBFpb@frankfurt-redis.render.com:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
  process.exit(1);
});

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis client connected successfully");
  } catch (error) {
    console.error("Redis connection failed:", error);
    process.exit(1);
  }
})();

let loggedInUsers = {};
let users = [];

function generateToken(login) {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 30; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${login}-${token}`;
}

function getRandomProfilePicture(direction) {
  const profilePictures = {
    programming: [
      "https://api.memory.mts.ru/api/1.0/preview/link/content/_gS0oZvT7E-ehq_BtWUpDA",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/e7vcXc5-ZkOKOIhO0Ardwg",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/yH5-2qTEAUqeD2eKYdzdJA",
    ],
    "3d_modeling": [
      "https://api.memory.mts.ru/api/1.0/preview/link/content/wOyauQ9gXEqKqQ6h9Os1lQ",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/k8rOYDBg_0y66gU0qrc6oA",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/mMuD69pN3U2mZ4G0u0R-Tg",
    ],
    journalism: [
      "https://api.memory.mts.ru/api/1.0/preview/link/content/Q6_169jXgEuyIuN06rN01w",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/r9o0F9b5hE28V-70Z3s9jA",
      "https://api.memory.mts.ru/api/1.0/preview/link/content/rN0zE6z3mkmK32vG5R4gwg",
    ],
  };

  const picturesForDirection =
    profilePictures[direction] || ["https://example.com/default.png"];
  return picturesForDirection[
    Math.floor(Math.random() * picturesForDirection.length)
  ];
}

async function loadUsersFromRedis() {
  try {
    const keys = await redisClient.keys("user:*");
    for (const key of keys) {
      const user = await redisClient.hGetAll(key);
      if (user) {
        user.state = JSON.parse(user.state);
        user.interests = JSON.parse(user.interests);
        user.history = JSON.parse(user.history);
        users.push(user);
      }
    }
    console.log("Users loaded from Redis:", users);
  } catch (error) {
    console.error("Failed to load users from Redis:", error);
  }
}

loadUsersFromRedis();

async function saveUserToRedis(user) {
  try {
    await redisClient.hSet(`user:${user.login}`, {
      login: user.login,
      password: user.password,
      direction: user.direction,
      state: JSON.stringify(user.state),
      profilePicture: user.profilePicture,
      interests: JSON.stringify(user.interests),
      name: user.name,
      history: JSON.stringify(user.history),
    });

    console.log(`User ${user.login} saved to Redis`);
  } catch (error) {
    console.error(`Failed to save user ${user.login} to Redis:`, error);
  }
}

app.post("/register", async (req, res) => {
  const { login, password, direction } = req.body;
  const existingUser = users.find((user) => user.login === login);
  if (existingUser) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Пользователь с таким логином уже существует",
      });
  }

  const profilePicture = getRandomProfilePicture(direction);
  const newUser = {
    login,
    password,
    direction,
    state: false,
    profilePicture,
    interests: [],
    name: "",
    history: [],
  };
  users.push(newUser);
  await saveUserToRedis(newUser);
  const token = generateToken(login);
  loggedInUsers[token] = { login, direction };

  res
    .status(201)
    .json({
      success: true,
      token,
      direction,
      profilePicture,
      message: "Регистрация прошла успешно",
    });
});

app.post("/auth", async (req, res) => {
  const { login, password } = req.body;
  const user = users.find((u) => u.login === login && u.password === password);
  if (user) {
    const token = generateToken(login);
    loggedInUsers[token] = { login, direction: user.direction };
    return res.json({
      success: true,
      token,
      direction: user.direction,
      profilePicture: user.profilePicture,
      interests: user.interests,
      name: user.name,
      history: user.history,
    });
  }
  res.status(401).json({ success: false, message: "Неверный логин или пароль" });
});

app.post("/verify-token", (req, res) => {
  const { token } = req.body;
  if (loggedInUsers[token]) {
    const { direction, login } = loggedInUsers[token];
    const user = users.find((u) => u.login === login);
    if (user) {
      return res.json({
        success: true,
        direction,
        profilePicture: user.profilePicture,
        interests: user.interests,
        name: user.name,
        history: user.history,
      });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(401).json({ success: false });
});

app.post("/update-state", async (req, res) => {
  const { token } = req.body;
  const userLogin = loggedInUsers[token]?.login;
  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      targetUser.state = !targetUser.state;
      await saveUserToRedis(targetUser);
      return res.json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(400).json({ success: false, message: "Invalid token" });
});

app.post("/get-state", (req, res) => {
  const { token } = req.body;
  const userLogin = loggedInUsers[token]?.login;

  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      return res.json({ success: true, state: targetUser.state });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(400).json({ success: false, message: "Invalid token" });
});

app.post("/save-interests", async (req, res) => {
  const { token, interests } = req.body;
  const userLogin = loggedInUsers[token]?.login;

  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      targetUser.interests = interests;
      await saveUserToRedis(targetUser);
      return res.json({ success: true, message: "Интересы успешно сохранены" });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res
    .status(400)
    .json({ success: false, message: "Ошибка сохранения интересов" });
});

app.post("/save-name", async (req, res) => {
  const { token, name } = req.body;
  const userLogin = loggedInUsers[token]?.login;
  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      targetUser.name = name;
      await saveUserToRedis(targetUser);
      return res.json({ success: true, message: "Имя успешно сохранено" });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(400).json({ success: false, message: "Ошибка сохранения имени" });
});

app.post("/save-history", async (req, res) => {
  const { token, historyItem } = req.body;
  const userLogin = loggedInUsers[token]?.login;

  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      targetUser.history.push(historyItem);
      await saveUserToRedis(targetUser);
      return res.json({ success: true, message: "История успешно сохранена" });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(400).json({ success: false, message: "Ошибка сохранения истории" });
});

app.post("/get-history", (req, res) => {
  const { token } = req.body;
  const userLogin = loggedInUsers[token]?.login;

  if (userLogin) {
    const targetUser = users.find((u) => u.login === userLogin);
    if (targetUser) {
      return res.json({ success: true, history: targetUser.history });
    } else {
      return res.status(404).json({ success: false, message: "User not found" });
    }
  }
  res.status(400).json({ success: false, message: "Ошибка получения истории" });
});

app.post("/logout", (req, res) => {
  const { token } = req.body;
  if (loggedInUsers[token]) {
    delete loggedInUsers[token];
    return res.json({ success: true });
  }
  res.status(400).json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
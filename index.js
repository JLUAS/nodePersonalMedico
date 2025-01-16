const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mysql = require('mysql');
const dotenv = require("dotenv");
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Configuración de multer para almacenar el archivo en memoria
dotenv.config({ path: './.env' });

const app = express();

// Definir el directorio de carga de archivos
const uploadDir = path.join(__dirname, 'public', 'uploads');

// Verificar si el directorio de uploads existe; si no, crearlo
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer para almacenar archivos subidos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './'); // Directorio donde se guardarán las imágenes
  },
  filename: function (req, file, cb) {
    // Crear un nombre único para el archivo subido
    cb(null, Date.now() + path.extname(file.originalname)); // Añade un timestamp al nombre del archivo
  }
});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'josemariaurquieta@gmail.com', // tu correo electrónico
    pass: 'qryu jkna xqtr taqy ' // la contraseña de aplicación generada
  }
});

function sendEmail(username, email, authCode){
  const mailOptions = {
    from: 'jlurquieta1@gmail.com',
    to: email,
    subject: 'Confirmación de correo',
    text: `Hola ${username}.\n\n Por favor ingresa este codigo para poder confirmar tu correo electronico.\n\n ${authCode}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error enviando correo:', error);
    } else {
      console.log('Correo enviado', info.response);
    }
  });
}

app.use(bodyParser.json());
app.use(cors());

const port = process.env.PORT || 3030;

const dbConfig = {
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

pool.on('connection', (connection) => {
  console.log('New connection established with ID:', connection.threadId);
});

pool.on('acquire', (connection) => {
  console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('Connection %d released', connection.threadId);
});

pool.on('error', (err) => {
  console.error('MySQL error: ', err);
});

function handleDisconnect() {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection: ', err);
      setTimeout(handleDisconnect, 2000);
    } else {
      connection.release();
      console.log('MySQL connected');
    }
  });
}

handleDisconnect();

app.post('/register', async (req, res) => {
    const { email, password, username, rol, auth, authCode, speciality, hSpeciality } = req.body;
    console.log(req.body)
    const hashedPassword = await bcrypt.hash(password, 10);
    pool.getConnection((err, connection) => {
        if (err) return res.status(500).send(err);

        connection.beginTransaction(err => {
        if (err) {
            connection.release();
            return res.status(500).send(err);
        }

        connection.query('INSERT INTO users (email, password, username, rol, auth, authCode, speciality, hSpeciality) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [email, hashedPassword, username, rol, auth, authCode, speciality, hSpeciality], (err, result) => {
            if (err) {
            connection.rollback(() => {
                connection.release();
                return res.status(500).send(err);
            });
            } else {
            connection.commit(err => {
                if (err) {
                connection.rollback(() => {
                    connection.release();
                    return res.status(500).send(err);
                });
                } else {
                connection.release();
                res.status(200).send('Usuario registrado correctamente');
                sendEmail(username, email, authCode)
                }
            });
            }
        });
        });
    });
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);
    connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      connection.release();
      if (err) return res.status(500).send(err);

      if (!results.length || !(await bcrypt.compare(password, results[0].password))) {
        return res.status(401).send('Nombre de usuario o contraseña incorrecta');
      }
      const token = jwt.sign({ id: results[0].id, role: results[0].rol }, 'secretkey', { expiresIn: '74h' });
      res.status(200).send({ token,
        rol: results[0].rol
      });
    });
  });
})


app.post('/isAuthenticated', (req, res) => {
  const { email } = req.body;
  console.log(email)
  // Validar que se haya enviado el email
  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error obtaining database connection:", err);
      return res.status(500).send({ message: "Internal server error" });
    }

    connection.query(
      'SELECT auth FROM users WHERE email = ?',
      [email],
      (err, results) => {
        connection.release();

        if (err) {
          console.error("Error executing query:", err);
          return res.status(500).send({ message: "Internal server error" });
        }

        // Validar si se encontró un usuario con el email proporcionado
        if (results.length === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        // Revisar el valor de "auth"
        const isAuthenticated = results[0].auth;
        if (isAuthenticated) {
          return res.status(200).send({ isAuthenticated: true });
        } else {
          return res.status(200).send({ isAuthenticated: false });
        }
      }
    );
  });
});


app.post('/authenticateUser', (req, res) => {
  const { email, authCode } = req.body;

  // Verificar que los datos están presentes
  if (!email || !authCode) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send('Error al conectar con la base de datos');

    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).send('Error en la consulta');
      }

      // Verificar si el usuario fue encontrado
      if (results.length === 0) {
        connection.release();
        return res.status(404).send('Usuario no encontrado');
      }

      // Comparar el código de autenticación
      if (authCode === results[0].authCode) {
        // Actualizar el valor de authCode a TRUE
        connection.query(
          'UPDATE users SET auth = TRUE WHERE email = ?',
          [email],
          (err) => {
            connection.release();
            if (err) {
              return res.status(500).send('Error al actualizar authCode');
            }
            return res.status(200).send({ isAuthenticated: true });
          }
        );
      } else {
        connection.release();
        return res.status(401).send('Código de autenticación incorrecto');
      }
    });
  });
});


app.listen(port, () => {
    console.log(`Servidor ejecutándose en el puerto ${port}`);
});
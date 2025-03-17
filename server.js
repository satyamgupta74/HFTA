const express = require("express");
const mysql = require("mysql2");
const moment = require("moment-timezone");
const net = require("net");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const app = express();
const { error } = require("console");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
// const { console } = require("inspector");
port = 3809;


app.use(express.static("public"));
app.use(bodyParser.json());
const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: "Content-Type,Authorization",
};
app.use(cors());
app.use(cors(corsOptions));
const connection = mysql.createPool({
  host: "3.7.158.221",
  user: "admin_buildINT",
  password: "buildINT@2023$",
  database: "HFTA",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}); 
    
app.use(express.json());
// Connect to the MySQL database
connection.getConnection((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: " + err.message);
    return;
  }
  console.log("Connected to MySQL database");
});


app.post('/createHFTA', (req, res) => {
    const {
        FirstName,
        MiddleName,
        LastName,
        CurrentBelt,
        EmailID,
        Contact,
        AlternativeContact,
        GuardianName,
        Address,
        Gender,
        DateOfJoining,
        Password,
        Role,
        Username
    } = req.body;
  
    // Check for required fields
    if (!FirstName || !LastName || !EmailID || !Contact || !Password || !DateOfJoining || !MiddleName || !CurrentBelt || !AlternativeContact || !GuardianName || !Address || !Gender || !Role || !Username) {
        return res.status(400).json({ message: 'Required fields are missing' });
    }
  
    // Hash the password
    bcrypt.hash(Password, 10, (err, hashedPassword) => {
        if (err) {
            console.error("Error hashing password:", err);
            return res.status(500).json({ message: 'Error encrypting password' });
        }

        // SQL query to insert user
        const query = `
            INSERT INTO user (
                FirstName, 
                MiddleName, 
                LastName, 
                CurrentBelt, 
                EmailID, 
                Contact, 
                AlternativeContact, 
                GuardianName, 
                Address, 
                Gender, 
                DateOfJoining, 
                Password,  -- Password is here
                Role,
                Username
            ) VALUES (?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?)`; 
    
        const values = [
            FirstName,
            MiddleName,
            LastName,
            CurrentBelt,
            EmailID,
            Contact,
            AlternativeContact,
            GuardianName,
            Address,
            Gender,
            DateOfJoining,
            hashedPassword,  // Corrected: hashedPassword is now before Role
            Role,
            Username
        ];
    
        connection.query(query, values, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.status(201).json({ message: 'User created successfully', userId: result.insertId });
        });
    });
});



app.post('/login', (req, res) => {
    const { Username, Password } = req.body;

    if (!Username || !Password) {
        return res.status(400).json({ message: 'Username and Password are required' });
    }

    const query = 'SELECT * FROM user WHERE Username = ?';
    
    connection.query(query, [Username], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result[0];

        bcrypt.compare(Password, user.Password, (err, isMatch) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error comparing passwords' });
            }

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Generate JWT token and calculate expiration time
            const Token = jwt.sign(
                { userId: user.userId, Username: user.Username },
                'your_jwt_secret_key',  
                { expiresIn: '96h' }
            );

            // Calculate expiration time
            const expirationTime = new Date(Date.now() + (96 * 60 * 60 * 1000)); // 96 hours from now

            const updateQuery = 'UPDATE user SET Token = ?, expire_token = ? WHERE Username = ?';
            connection.query(updateQuery, [Token, expirationTime, Username], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Database error while storing token' });
                }
                
                res.status(200).json({ message: 'Login successful', Token, expire_token: expirationTime,Role: user.Role,Username: user.Username});
            });
        });
    });
});


app.post('/Attendance', (req, res) => {
    const { Username, Days, Time, Loaction, Decrptions,AttandanceStatus } = req.body;

    if (!Username || !Days || !Time || !Loaction || !Decrptions) {
        return res.status(400).json({ message: 'Required fields are missing' });
    }

    // Check if the user already has an entry for the given day
    const checkQuery = 'SELECT * FROM Attendance WHERE Username = ? AND Days = ?';
    connection.query(checkQuery, [Username, Days], (err, result) => {
        if (err) {
            console.error("Database Error:", err.sqlMessage); 
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        if (result.length > 0) {
            return res.status(409).json({ message: 'Attendance already marked for this day' });
        }

        // If no entry exists, insert the new attendance record
        const insertQuery = 'INSERT INTO Attendance (Username, Days, Time, Loaction, Decrptions,AttandanceStatus) VALUES (?,?, ?, ?, ?, ?)';
        connection.query(insertQuery, [Username, Days, Time, Loaction, Decrptions,AttandanceStatus || 1 ], (err, result) => {
            if (err) {
                console.error("Database Error:", err.sqlMessage); 
                return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
            }

            // If attendance is marked successfully, update Attendance column in user table
            // const updateQuery = 'UPDATE user SET Attendance = 1 WHERE Username = ?';
            // connection.query(updateQuery, [Username], (err, updateResult) => {
            //     if (err) {
            //         console.error("Database Error while updating user table:", err.sqlMessage); 
            //         return res.status(500).json({ message: 'Database error while updating attendance status', error: err.sqlMessage });
            //     }

                res.status(201).json({ message: 'Attendance marked successfully and status updated' });
            });
        });
    });



app.get('/Attendances', (req, res) => {
    const query = 'SELECT * FROM Attendance ORDER BY Id DESC';

    connection.query(query, (err, result) => {
        if (err) {
            console.error("Database Error:", err.sqlMessage); // Detailed error logging
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        // If no records are found
        if (result.length === 0) {
            return res.status(404).json({ message: 'No attendance records found' });
        }

        // Return the attendance records
        res.status(200).json({ message: 'Attendance records retrieved successfully', data: result });
    });
});

app.get('/UsersDetails', (req, res) => {
    const query = `SELECT ID,Role,Username,Contact,CurrentBelt FROM HFTA.user WHERE Role IN ('Student', 'Instructor') ORDER BY 1 DESC`;

    connection.query(query, (err, result) => {
        if (err) {
            console.error("Database Error:", err.sqlMessage); // Detailed error logging
            return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'No user records found' });
        }

        res.status(200).json({ message: 'User records retrieved successfully', data: result });
    });
});

app.get('/getHFTA/:username', (req, res) => {
    const { username } = req.params;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    const query = `
        SELECT FirstName, MiddleName, LastName, CurrentBelt, EmailID, Contact, 
               AlternativeContact, GuardianName, Address, Gender, DateOfJoining, Role, Username
        FROM user
        WHERE Username = ?`;

    connection.query(query, [username], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(result[0]);
    });
});


app.get("/attendance-stats", (req, res) => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format

    const totalUsersQuery = "SELECT COUNT(DISTINCT Username) AS totalStudents FROM user";
    const presentQuery = `SELECT COUNT(DISTINCT Username) AS totalPresent FROM Attendance 
                          WHERE AttandanceStatus = 1 AND DATE(Time) = ?`;

    connection.query(totalUsersQuery, (err, userResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const totalStudents = userResult[0].totalStudents;

        connection.query(presentQuery, [today], (err, presentResult) => {
            if (err) return res.status(500).json({ error: err.message });

            const totalPresent = presentResult[0].totalPresent;
            const percentagePresent = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
            const percentageNotPresent = 100 - percentagePresent; // Calculate not present percentage

            res.json({
                totalStudents,
                totalPresent,
                percentagePresent: percentagePresent.toFixed(2) + "%",
                percentageNotPresent: percentageNotPresent.toFixed(2) + "%"
            });
        });
    });
});



console.log("Starting the server...");
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


// Serverless function wrapper for Vercel
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Parser } = require('json2csv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting - General
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many requests, please try again later.' }
});

// Rate limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: 'Too many login attempts, please try again after 15 minutes.' }
});

// Rate limiting - Password reset
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { message: 'Too many password reset requests, please try again after an hour.' }
});

app.use('/api', generalLimiter);

// ===========================================
// DATABASE CONNECTION
// ===========================================
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('Using existing database connection');
        return;
    }
    
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log('✅ MongoDB Atlas connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        throw err;
    }
};

// ===========================================
// EMAIL CONFIGURATION
// ===========================================
let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    console.log('📧 Email service configured');
} else {
    console.log('⚠️  Email service not configured (SMTP credentials missing)');
}

// Email templates
const emailTemplates = {
    welcome: (name) => ({
        subject: 'Welcome to MKcode!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to MKcode!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2>Hello ${name}!</h2>
                    <p>Thank you for joining MKcode. We're excited to have you on board!</p>
                    <p>Start exploring our innovative IT solutions and services.</p>
                    <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Get Started</a>
                </div>
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p>© ${new Date().getFullYear()} MKcode. All rights reserved.</p>
                </div>
            </div>
        `
    }),
    passwordReset: (name, resetCode) => ({
        subject: 'Password Reset Code - MKcode',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🔒 Password Reset</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2>Hello ${name}!</h2>
                    <p style="font-size: 16px;">You requested to reset your password. Use the verification code below:</p>
                    
                    <div style="background: white; border: 2px dashed #22c55e; border-radius: 10px; padding: 25px; margin: 30px 0; text-align: center;">
                        <p style="margin: 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Reset Code</p>
                        <h1 style="margin: 15px 0; color: #22c55e; font-size: 42px; letter-spacing: 8px; font-family: 'Courier New', monospace;">${resetCode}</h1>
                        <p style="margin: 0; color: #666; font-size: 12px;">Enter this code on the password reset page</p>
                    </div>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                            <strong>⚠️ Important:</strong> This code will expire in <strong>15 minutes</strong>.
                        </p>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">If you didn't request this password reset, please ignore this email or contact our support team immediately.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #666; font-size: 13px; margin: 5px 0;">
                            <strong>Security Tips:</strong>
                        </p>
                        <ul style="color: #666; font-size: 13px; margin: 10px 0; padding-left: 20px;">
                            <li>Never share this code with anyone</li>
                            <li>MKcode will never ask for your code via phone or email</li>
                            <li>Make sure you're on the official MKcode website</li>
                        </ul>
                    </div>
                </div>
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f3f4f6;">
                    <p style="margin: 5px 0;">This is an automated message from MKcode</p>
                    <p style="margin: 5px 0;">© ${new Date().getFullYear()} MKcode. All rights reserved.</p>
                </div>
            </div>
        `
    }),
    contactConfirmation: (name) => ({
        subject: 'We received your message - MKcode',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Message Received!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2>Hello ${name}!</h2>
                    <p>Thank you for contacting us. We have received your message and will get back to you within 24-48 hours.</p>
                    <p>In the meantime, feel free to explore our services.</p>
                </div>
            </div>
        `
    }),
    newsletterWelcome: (email) => ({
        subject: 'Welcome to MKcode Newsletter!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">You're Subscribed!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <p>Thank you for subscribing to the MKcode newsletter!</p>
                    <p>You'll receive the latest updates on our services, tech insights, and exclusive offers.</p>
                </div>
            </div>
        `
    }),
    contactNotification: (name, email, subject, message) => ({
        subject: `New Contact Form Submission - ${subject}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">📩 New Contact Message</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                    <h2>New message from your website!</h2>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>From:</strong> ${name}</p>
                        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        <p><strong>Subject:</strong> ${subject}</p>
                        <hr style="border: 1px solid #e5e7eb; margin: 15px 0;">
                        <p><strong>Message:</strong></p>
                        <p style="white-space: pre-wrap; background: #f9fafb; padding: 15px; border-radius: 5px;">${message}</p>
                    </div>
                    <p style="color: #666; font-size: 14px;">Reply to this message by emailing ${email}</p>
                </div>
            </div>
        `
    })
};

// Helper function to send emails
const sendEmail = async (to, templateData) => {
    if (!transporter) {
        console.log('⚠️  Email not sent (service not configured)');
        return false;
    }

    try {
        await transporter.sendMail({
            from: `"MKcode" <${process.env.SMTP_USER}>`,
            to,
            subject: templateData.subject,
            html: templateData.html
        });
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
};

// ===========================================
// FILE UPLOAD CONFIGURATION
// ===========================================
const uploadDir = path.join(__dirname, '../uploads/avatars');

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// ===========================================
// DATABASE MODELS
// ===========================================

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: String,
    avatar: String,
    bio: String,
    location: String,
    website: String,
    socialLinks: {
        linkedin: String,
        github: String,
        twitter: String
    },
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    passwordResetCode: String,
    passwordResetExpires: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);

// Contact Schema
const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'new', enum: ['new', 'read', 'responded', 'archived'] },
    priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high', 'urgent'] },
    notes: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', contactSchema);

// Newsletter Schema
const newsletterSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    status: { type: String, default: 'active', enum: ['active', 'unsubscribed'] },
    subscribedAt: { type: Date, default: Date.now }
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// Project Schema
const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    technologies: [String],
    image: String,
    link: String,
    githubLink: String,
    featured: { type: Boolean, default: false },
    status: { type: String, default: 'completed', enum: ['in-progress', 'completed', 'archived'] },
    clientName: String,
    startDate: Date,
    endDate: Date,
    teamSize: Number,
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);

// Blog Post Schema
const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    tags: [String],
    featuredImage: String,
    published: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        comment: String,
        createdAt: { type: Date, default: Date.now }
    }],
    seo: {
        metaTitle: String,
        metaDescription: String,
        keywords: [String]
    },
    publishedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Create slug from title
blogSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = this.title.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim();
    }
    this.updatedAt = Date.now();
    next();
});

const Blog = mongoose.model('Blog', blogSchema);

// Job Schema
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    department: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, required: true, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'] },
    experience: { type: String, required: true },
    salary: String,
    description: { type: String, required: true },
    responsibilities: [String],
    qualifications: [String],
    benefits: [String],
    status: { type: String, default: 'active', enum: ['active', 'closed', 'on-hold'] },
    applicants: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    closingDate: Date
});

const Job = mongoose.model('Job', jobSchema);

// Job Application Schema
const applicationSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicantName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    resume: { type: String, required: true },
    coverLetter: String,
    experience: Number,
    linkedIn: String,
    portfolio: String,
    status: { type: String, default: 'pending', enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'] },
    notes: String,
    appliedAt: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', applicationSchema);

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
    page: { type: String, required: true },
    sessionId: String,
    userAgent: String,
    referrer: String,
    timestamp: { type: Date, default: Date.now }
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

// ===========================================
// MIDDLEWARE
// ===========================================

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// Admin check middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
};

// ===========================================
// API ROUTES
// ===========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'MKcode API is working!' });
});

// User Registration
app.post('/api/register',
    authLimiter,
    [
        body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password } = req.body;

        try {
            await connectDB();
            
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists with this email' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            
            const user = new User({
                name,
                email,
                password: hashedPassword
            });

            await user.save();

            // Send welcome email (non-blocking)
            if (transporter) {
                sendEmail(email, emailTemplates.welcome(name)).catch(err => 
                    console.error('Welcome email failed:', err)
                );
            }

            const token = jwt.sign(
                { userId: user._id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                message: 'Registration successful',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar
                }
            });
        } catch (err) {
            console.error('Registration error:', err);
            res.status(500).json({ message: 'Registration failed', error: err.message });
        }
    }
);

// User Login
app.post('/api/login',
    authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            await connectDB();
            
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            if (!user.isActive) {
                return res.status(403).json({ message: 'Account has been deactivated' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Update login stats
            user.lastLogin = new Date();
            user.loginCount += 1;
            await user.save();

            const token = jwt.sign(
                { userId: user._id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    lastLogin: user.lastLogin
                }
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ message: 'Login failed', error: err.message });
        }
    }
);

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        await connectDB();
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { name, phone, bio, location, website, socialLinks } = req.body;

    try {
        await connectDB();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;
        if (website !== undefined) user.website = website;
        if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                bio: user.bio,
                location: user.location,
                website: user.website,
                socialLinks: user.socialLinks,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

// Upload avatar
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        await connectDB();
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old avatar if exists
        if (user.avatar) {
            const oldAvatarPath = path.join(__dirname, '../', user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        user.avatar = `/uploads/avatars/${req.file.filename}`;
        await user.save();

        res.json({
            message: 'Avatar uploaded successfully',
            avatar: user.avatar
        });
    } catch (err) {
        res.status(500).json({ message: 'Avatar upload failed' });
    }
});

// Password reset request
app.post('/api/forgot-password',
    resetLimiter,
    [body('email').isEmail().normalizeEmail()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        try {
            await connectDB();
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'No user found with this email' });
            }

            const resetCode = crypto.randomInt(100000, 999999).toString();
            user.passwordResetCode = await bcrypt.hash(resetCode, 10);
            user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
            await user.save();

            // Send reset email
            const emailSent = await sendEmail(email, emailTemplates.passwordReset(user.name, resetCode));

            if (!emailSent) {
                return res.status(500).json({ message: 'Failed to send reset email' });
            }

            res.json({ message: 'Password reset code sent to your email' });
        } catch (err) {
            res.status(500).json({ message: 'Password reset request failed' });
        }
    }
);

// Verify reset code
app.post('/api/verify-reset-code',
    [
        body('email').isEmail().normalizeEmail(),
        body('code').isLength({ min: 6, max: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, code } = req.body;

        try {
            await connectDB();
            const user = await User.findOne({ email });
            if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
                return res.status(400).json({ message: 'Invalid or expired reset code' });
            }

            if (Date.now() > user.passwordResetExpires) {
                return res.status(400).json({ message: 'Reset code has expired' });
            }

            const isCodeValid = await bcrypt.compare(code, user.passwordResetCode);
            if (!isCodeValid) {
                return res.status(400).json({ message: 'Invalid reset code' });
            }

            res.json({ message: 'Code verified successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Code verification failed' });
        }
    }
);

// Reset password
app.post('/api/reset-password',
    [
        body('email').isEmail().normalizeEmail(),
        body('code').isLength({ min: 6, max: 6 }),
        body('newPassword').isLength({ min: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, code, newPassword } = req.body;

        try {
            await connectDB();
            const user = await User.findOne({ email });
            if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
                return res.status(400).json({ message: 'Invalid or expired reset code' });
            }

            if (Date.now() > user.passwordResetExpires) {
                return res.status(400).json({ message: 'Reset code has expired' });
            }

            const isCodeValid = await bcrypt.compare(code, user.passwordResetCode);
            if (!isCodeValid) {
                return res.status(400).json({ message: 'Invalid reset code' });
            }

            user.password = await bcrypt.hash(newPassword, 10);
            user.passwordResetCode = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            res.json({ message: 'Password reset successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Password reset failed' });
        }
    }
);

// Contact form submission
app.post('/api/contact',
    [
        body('name').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('subject').trim().notEmpty(),
        body('message').trim().notEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, subject, message } = req.body;

        try {
            await connectDB();
            const contact = new Contact({ name, email, subject, message });
            await contact.save();

            // Send confirmation to user
            if (transporter) {
                sendEmail(email, emailTemplates.contactConfirmation(name)).catch(err =>
                    console.error('Confirmation email failed:', err)
                );

                // Notify admin
                if (process.env.ADMIN_EMAIL) {
                    sendEmail(
                        process.env.ADMIN_EMAIL,
                        emailTemplates.contactNotification(name, email, subject, message)
                    ).catch(err => console.error('Admin notification failed:', err));
                }
            }

            res.status(201).json({ message: 'Message sent successfully!' });
        } catch (err) {
            res.status(500).json({ message: 'Failed to send message' });
        }
    }
);

// Get all contacts (Admin)
app.get('/api/contacts', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const { status, priority } = req.query;
        let query = {};
        
        if (status) query.status = status;
        if (priority) query.priority = priority;

        const contacts = await Contact.find(query)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'name email');
        
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch contacts' });
    }
});

// Update contact status (Admin)
app.put('/api/contacts/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const { status, priority, notes, assignedTo } = req.body;
        const contact = await Contact.findById(req.params.id);
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        if (status) contact.status = status;
        if (priority) contact.priority = priority;
        if (notes !== undefined) contact.notes = notes;
        if (assignedTo !== undefined) contact.assignedTo = assignedTo;

        await contact.save();
        res.json({ message: 'Contact updated successfully', contact });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update contact' });
    }
});

// Newsletter subscription
app.post('/api/newsletter',
    [body('email').isEmail().normalizeEmail()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        try {
            await connectDB();
            const existing = await Newsletter.findOne({ email });
            if (existing) {
                if (existing.status === 'unsubscribed') {
                    existing.status = 'active';
                    existing.subscribedAt = new Date();
                    await existing.save();
                    return res.json({ message: 'Resubscribed successfully!' });
                }
                return res.status(400).json({ message: 'Email already subscribed' });
            }

            const subscription = new Newsletter({ email });
            await subscription.save();

            // Send welcome email
            if (transporter) {
                sendEmail(email, emailTemplates.newsletterWelcome(email)).catch(err =>
                    console.error('Newsletter welcome email failed:', err)
                );
            }

            res.status(201).json({ message: 'Subscribed successfully!' });
        } catch (err) {
            res.status(500).json({ message: 'Subscription failed' });
        }
    }
);

// Get all newsletter subscribers (Admin)
app.get('/api/newsletter', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
        res.json(subscribers);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch subscribers' });
    }
});

// Export newsletter (Admin)
app.get('/api/newsletter/export', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const subscribers = await Newsletter.find({ status: 'active' });
        const fields = ['email', 'subscribedAt', 'status'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(subscribers);

        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', 'attachment; filename=newsletter-subscribers.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: 'Export failed' });
    }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
    try {
        await connectDB();
        const { category, featured, status } = req.query;
        let query = {};
        
        if (category) query.category = category;
        if (featured) query.featured = featured === 'true';
        if (status) query.status = status;

        const projects = await Project.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch projects' });
    }
});

// Get single project
app.get('/api/projects/:id', async (req, res) => {
    try {
        await connectDB();
        const project = await Project.findById(req.params.id)
            .populate('createdBy', 'name email avatar');
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Increment views
        project.views += 1;
        await project.save();

        res.json(project);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch project' });
    }
});

// Create project (Admin)
app.post('/api/projects', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const projectData = {
            ...req.body,
            createdBy: req.user.userId
        };
        const project = new Project(projectData);
        await project.save();
        res.status(201).json({ message: 'Project created successfully', project });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create project' });
    }
});

// Update project (Admin)
app.put('/api/projects/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({ message: 'Project updated successfully', project });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update project' });
    }
});

// Delete project (Admin)
app.delete('/api/projects/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const project = await Project.findByIdAndDelete(req.params.id);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete project' });
    }
});

// Like project
app.post('/api/projects/:id/like', async (req, res) => {
    try {
        await connectDB();
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        project.likes += 1;
        await project.save();

        res.json({ message: 'Project liked', likes: project.likes });
    } catch (err) {
        res.status(500).json({ message: 'Failed to like project' });
    }
});

// Get all blogs
app.get('/api/blogs', async (req, res) => {
    try {
        await connectDB();
        const { category, tag, published } = req.query;
        let query = {};
        
        if (category) query.category = category;
        if (tag) query.tags = tag;
        if (published !== undefined) query.published = published === 'true';

        const blogs = await Blog.find(query)
            .populate('author', 'name email avatar')
            .sort({ createdAt: -1 });
        
        res.json(blogs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blogs' });
    }
});

// Get single blog
app.get('/api/blogs/:slug', async (req, res) => {
    try {
        await connectDB();
        const blog = await Blog.findOne({ slug: req.params.slug })
            .populate('author', 'name email avatar bio')
            .populate('comments.user', 'name avatar');
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        // Increment views
        blog.views += 1;
        await blog.save();

        res.json(blog);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blog' });
    }
});

// Create blog (Admin)
app.post('/api/blogs', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const blogData = {
            ...req.body,
            author: req.user.userId
        };
        
        if (req.body.published) {
            blogData.publishedAt = new Date();
        }

        const blog = new Blog(blogData);
        await blog.save();
        res.status(201).json({ message: 'Blog created successfully', blog });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create blog' });
    }
});

// Update blog (Admin)
app.put('/api/blogs/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        // If publishing for the first time
        if (!blog.published && req.body.published) {
            req.body.publishedAt = new Date();
        }

        Object.assign(blog, req.body);
        await blog.save();

        res.json({ message: 'Blog updated successfully', blog });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update blog' });
    }
});

// Delete blog (Admin)
app.delete('/api/blogs/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const blog = await Blog.findByIdAndDelete(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        res.json({ message: 'Blog deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete blog' });
    }
});

// Like blog
app.post('/api/blogs/:id/like', async (req, res) => {
    try {
        await connectDB();
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        blog.likes += 1;
        await blog.save();

        res.json({ message: 'Blog liked', likes: blog.likes });
    } catch (err) {
        res.status(500).json({ message: 'Failed to like blog' });
    }
});

// Add comment to blog
app.post('/api/blogs/:id/comments', authenticateToken, async (req, res) => {
    try {
        await connectDB();
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        blog.comments.push({
            user: req.user.userId,
            comment: req.body.comment
        });

        await blog.save();
        await blog.populate('comments.user', 'name avatar');

        res.json({ message: 'Comment added successfully', comments: blog.comments });
    } catch (err) {
        res.status(500).json({ message: 'Failed to add comment' });
    }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
    try {
        await connectDB();
        const { department, type, location, status } = req.query;
        let query = {};
        
        if (department) query.department = department;
        if (type) query.type = type;
        if (location) query.location = location;
        if (status) query.status = status;
        else query.status = 'active'; // Default to active jobs

        const jobs = await Job.find(query)
            .populate('postedBy', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch jobs' });
    }
});

// Get single job
app.get('/api/jobs/:id', async (req, res) => {
    try {
        await connectDB();
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'name email');
        
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json(job);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch job' });
    }
});

// Create job (Admin)
app.post('/api/jobs', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const jobData = {
            ...req.body,
            postedBy: req.user.userId
        };
        const job = new Job(jobData);
        await job.save();
        res.status(201).json({ message: 'Job posted successfully', job });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create job' });
    }
});

// Update job (Admin)
app.put('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const job = await Job.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json({ message: 'Job updated successfully', job });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update job' });
    }
});

// Delete job (Admin)
app.delete('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const job = await Job.findByIdAndDelete(req.params.id);
        
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json({ message: 'Job deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete job' });
    }
});

// Apply for job
app.post('/api/jobs/:id/apply',
    [
        body('applicantName').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('phone').trim().notEmpty(),
        body('resume').trim().notEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            await connectDB();
            const job = await Job.findById(req.params.id);
            
            if (!job) {
                return res.status(404).json({ message: 'Job not found' });
            }

            if (job.status !== 'active') {
                return res.status(400).json({ message: 'Job is no longer accepting applications' });
            }

            const application = new Application({
                jobId: req.params.id,
                ...req.body
            });

            await application.save();

            // Update job applicant count
            job.applicants += 1;
            await job.save();

            res.status(201).json({ message: 'Application submitted successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Failed to submit application' });
        }
    }
);

// Get all applications for a job (Admin)
app.get('/api/jobs/:id/applications', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const applications = await Application.find({ jobId: req.params.id })
            .populate('jobId', 'title department')
            .sort({ appliedAt: -1 });
        
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch applications' });
    }
});

// Get all applications (Admin)
app.get('/api/applications', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const { status } = req.query;
        let query = {};
        
        if (status) query.status = status;

        const applications = await Application.find(query)
            .populate('jobId', 'title department')
            .sort({ appliedAt: -1 });
        
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch applications' });
    }
});

// Update application status (Admin)
app.put('/api/applications/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const { status, notes } = req.body;
        const application = await Application.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        if (status) application.status = status;
        if (notes !== undefined) application.notes = notes;

        await application.save();
        res.json({ message: 'Application updated successfully', application });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update application' });
    }
});

// Track analytics
app.post('/api/analytics', async (req, res) => {
    try {
        await connectDB();
        const { page, sessionId, userAgent, referrer } = req.body;
        
        const analytics = new Analytics({
            page,
            sessionId,
            userAgent,
            referrer
        });

        await analytics.save();
        res.status(201).json({ message: 'Analytics tracked' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to track analytics' });
    }
});

// Get analytics (Admin)
app.get('/api/analytics', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const { startDate, endDate, page } = req.query;
        let query = {};
        
        if (page) query.page = page;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const analytics = await Analytics.find(query).sort({ timestamp: -1 });
        
        // Calculate stats
        const pageViews = analytics.reduce((acc, curr) => {
            acc[curr.page] = (acc[curr.page] || 0) + 1;
            return acc;
        }, {});

        const uniqueVisitors = await Analytics.distinct('sessionId', query);
        
        res.json({
            totalViews: analytics.length,
            uniqueVisitors: uniqueVisitors.length,
            pageViews,
            details: analytics
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
});

// Get dashboard stats (Admin)
app.get('/api/dashboard/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        await connectDB();
        const stats = {
            users: await User.countDocuments(),
            contacts: await Contact.countDocuments({ status: 'new' }),
            projects: await Project.countDocuments(),
            blogs: await Blog.countDocuments(),
            jobs: await Job.countDocuments({ status: 'active' }),
            applications: await Application.countDocuments({ status: 'pending' }),
            newsletter: await Newsletter.countDocuments({ status: 'active' })
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});

// ===========================================
// SERVERLESS EXPORT
// ===========================================

// Export handler for Vercel serverless
module.exports = async (req, res) => {
    // Ensure database connection
    await connectDB();
    
    // Handle the request with Express app
    return app(req, res);
};

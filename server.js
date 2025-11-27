// Enhanced Express server for MKcode with advanced features
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
    origin: '*', // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting - General
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: 'Too many requests, please try again later.' }
});

// Rate limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { message: 'Too many login attempts, please try again after 15 minutes.' }
});

// Rate limiting - Password reset
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { message: 'Too many password reset requests, please try again after an hour.' }
});

app.use('/api', generalLimiter);

// ===========================================
// DATABASE CONNECTION
// ===========================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB Atlas connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ===========================================
// EMAIL CONFIGURATION
// ===========================================
let transporter = null;

// Only create transporter if SMTP credentials are provided
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
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p>This message was sent from the MKcode contact form</p>
                </div>
            </div>
        `
    })
};

// Send email helper function
async function sendEmail(to, template, ...args) {
    // Skip email if SMTP is not configured
    if (!transporter) {
        console.log(`📧 Email skipped (SMTP not configured): ${to}`);
        return true;
    }
    
    try {
        const { subject, html } = template(...args);
        console.log(`📧 Attempting to send email to ${to} with subject: ${subject}`);
        
        const info = await transporter.sendMail({
            from: `"MKcode" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        
        console.log(`✅ Email sent successfully to ${to}`);
        console.log(`📬 Message ID: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error('❌ Email error:', err.message);
        console.error('Full error:', err);
        // Don't fail registration if email fails
        return true;
    }
}

// ===========================================
// FILE UPLOAD CONFIGURATION
// ===========================================
const uploadDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// ===========================================
// DATABASE SCHEMAS
// ===========================================

// Enhanced User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    bio: { type: String, maxlength: 500, default: '' },
    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    github: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    twitter: { type: String, default: '' },
    website: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    lastLogin: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    preferences: {
        emailNotifications: { type: Boolean, default: true },
        newsletterSubscribed: { type: Boolean, default: false },
        darkMode: { type: Boolean, default: false }
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Contact Schema with status tracking
const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'replied', 'archived'], default: 'new' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    repliedAt: { type: Date },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

// Newsletter Schema with preferences
const newsletterSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    preferences: {
        promotions: { type: Boolean, default: true },
        updates: { type: Boolean, default: true },
        blog: { type: Boolean, default: true }
    },
    unsubscribeToken: { type: String }
}, { timestamps: true });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// Password Reset Token Schema
const resetTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expires: { type: Date, required: true }
});

const ResetToken = mongoose.model('ResetToken', resetTokenSchema);

// Email Verification Token Schema
const verificationTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expires: { type: Date, required: true }
});

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

// Activity Log Schema
const activityLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    target: String,
    details: Object,
    ipAddress: String,
    userAgent: String
}, { timestamps: true });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// Blog/Article Schema
const blogSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    excerpt: { type: String, maxlength: 300 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true, enum: ['Technology', 'Web Development', 'Mobile Apps', 'AI/ML', 'Cloud', 'Security', 'Tutorial', 'News', 'Case Study'] },
    tags: [{ type: String }],
    featuredImage: { type: String },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    publishedAt: { type: Date },
    readTime: { type: Number } // in minutes
}, { timestamps: true });

const Blog = mongoose.model('Blog', blogSchema);

// Blog Comment Schema
const commentSchema = new mongoose.Schema({
    blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);

// Testimonial/Review Schema
const testimonialSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String },
    position: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true, maxlength: 500 },
    projectType: { type: String },
    avatarUrl: { type: String },
    isApproved: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    displayOnHome: { type: Boolean, default: false }
}, { timestamps: true });

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// Job Posting Schema
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    department: { type: String, required: true, enum: ['Engineering', 'Design', 'Marketing', 'Sales', 'Support', 'HR', 'Management'] },
    location: { type: String, required: true },
    type: { type: String, required: true, enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'] },
    experience: { type: String, required: true, enum: ['Entry Level', 'Mid Level', 'Senior Level', 'Lead/Manager'] },
    salary: {
        min: { type: Number },
        max: { type: Number },
        currency: { type: String, default: 'INR' }
    },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    responsibilities: [{ type: String }],
    benefits: [{ type: String }],
    skills: [{ type: String }],
    isActive: { type: Boolean, default: true },
    applicationCount: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

// Job Application Schema
const applicationSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicantName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    resume: { type: String, required: true }, // file path
    coverLetter: { type: String },
    portfolio: { type: String },
    linkedin: { type: String },
    github: { type: String },
    experience: { type: Number }, // in years
    currentCompany: { type: String },
    expectedSalary: { type: Number },
    noticePeriod: { type: String },
    status: { type: String, enum: ['pending', 'reviewing', 'shortlisted', 'interviewed', 'rejected', 'accepted'], default: 'pending' },
    notes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);

// FAQ Schema
const faqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, required: true, enum: ['General', 'Services', 'Pricing', 'Technical', 'Support', 'Billing', 'Security'] },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 }
}, { timestamps: true });

const FAQ = mongoose.model('FAQ', faqSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['info', 'success', 'warning', 'error', 'message', 'system'] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    icon: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
    page: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    referrer: { type: String },
    country: { type: String },
    device: { type: String },
    browser: { type: String },
    duration: { type: Number }, // in seconds
    actions: [{ 
        type: { type: String },
        target: { type: String },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const Analytics = mongoose.model('Analytics', analyticsSchema);

// ===========================================
// MIDDLEWARE
// ===========================================

// JWT Authentication Middleware
function auth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid or expired' });
    }
}

// Admin Authorization Middleware
async function adminAuth(req, res, next) {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
}

// Activity Logging Helper
async function logActivity(adminId, action, target, details, req) {
    try {
        await new ActivityLog({
            adminId,
            action,
            target,
            details,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }).save();
    } catch (err) {
        console.error('Activity log error:', err);
    }
}

// Validation Error Handler
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Validation failed', 
            errors: errors.array().map(e => e.msg) 
        });
    }
    next();
};

// ===========================================
// AUTH ROUTES
// ===========================================

// Register
app.post('/api/register', 
    authLimiter,
    [
        body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    handleValidation,
    async (req, res) => {
        const { name, email, password } = req.body;
        try {
            const existing = await User.findOne({ email });
            if (existing) return res.status(400).json({ message: 'User already exists with this email' });
            
            const hashed = await bcrypt.hash(password, 12);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            
            const user = new User({ 
                name, 
                email, 
                password: hashed,
                verificationToken
            });
            await user.save();

            // Create verification token
            await new VerificationToken({
                userId: user._id,
                token: verificationToken,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }).save();

            // Send welcome email
            await sendEmail(email, emailTemplates.welcome, name);

            // Generate JWT
            const token = jwt.sign(
                { id: user._id, email: user.email, role: user.role }, 
                process.env.JWT_SECRET, 
                { expiresIn: '7d' }
            );

            res.status(201).json({ 
                message: 'User registered successfully',
                token,
                user: { id: user._id, name: user.name, email: user.email, role: user.role }
            });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ message: 'Server error during registration' });
        }
    }
);

// Login
app.post('/api/login', 
    authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password required')
    ],
    handleValidation,
    async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await User.findOne({ email });
            if (!user) return res.status(400).json({ message: 'Invalid credentials' });
            if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
            
            // Update last login
            user.lastLogin = new Date();
            user.loginCount += 1;
            await user.save();

            const token = jwt.sign(
                { id: user._id, email: user.email, role: user.role }, 
                process.env.JWT_SECRET, 
                { expiresIn: '7d' }
            );

            res.json({ 
                token, 
                user: { 
                    id: user._id,
                    name: user.name, 
                    email: user.email, 
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    isVerified: user.isVerified
                } 
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

// ===========================================
// PROFILE ROUTES
// ===========================================

// Get Profile
app.get('/api/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -verificationToken');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update Profile
app.put('/api/profile', 
    auth,
    [
        body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
        body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
        body('website').optional().isURL().withMessage('Valid URL required for website')
    ],
    handleValidation,
    async (req, res) => {
        const allowedUpdates = [
            'name', 'email', 'bio', 'github', 'linkedin', 'twitter', 
            'website', 'phone', 'location', 'coverUrl', 'preferences'
        ];
        const updates = {};
        
        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // Handle password separately with hashing
        if (req.body.password) {
            updates.password = await bcrypt.hash(req.body.password, 12);
        }

        try {
            // Check if email is being changed and is unique
            if (updates.email) {
                const existing = await User.findOne({ email: updates.email, _id: { $ne: req.user.id } });
                if (existing) return res.status(400).json({ message: 'Email already in use' });
            }

            const user = await User.findByIdAndUpdate(
                req.user.id, 
                updates, 
                { new: true, runValidators: true }
            ).select('-password -verificationToken');
            
            res.json(user);
        } catch (err) {
            res.status(400).json({ message: 'Update failed: ' + err.message });
        }
    }
);

// Upload Avatar
app.post('/api/profile/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        // Delete old avatar if exists
        const user = await User.findById(req.user.id);
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, user.avatarUrl);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        user.avatarUrl = avatarUrl;
        await user.save();

        res.json({ avatarUrl, message: 'Avatar uploaded successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Avatar upload failed' });
    }
});

// Change Password (with old password verification)
app.put('/api/profile/password', 
    auth,
    [
        body('oldPassword').notEmpty().withMessage('Current password required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    ],
    handleValidation,
    async (req, res) => {
        const { oldPassword, newPassword } = req.body;
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

            user.password = await bcrypt.hash(newPassword, 12);
            await user.save();

            res.json({ message: 'Password changed successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Password change failed' });
        }
    }
);

// Delete Own Account
app.delete('/api/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Delete avatar if exists
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const avatarPath = path.join(__dirname, user.avatarUrl);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        // Clean up related data
        await ResetToken.deleteMany({ userId: user._id });
        await VerificationToken.deleteMany({ userId: user._id });
        await Newsletter.deleteOne({ email: user.email });

        await User.findByIdAndDelete(req.user.id);

        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Account deletion failed' });
    }
});

// ===========================================
// PASSWORD RESET ROUTES
// ===========================================

// Request Password Reset - Send Verification Code
app.post('/api/request-reset', 
    resetLimiter,
    [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
    handleValidation,
    async (req, res) => {
        const { email } = req.body;
        try {
            const user = await User.findOne({ email });
            
            // Always return success message to prevent email enumeration
            if (!user) {
                return res.json({ 
                    success: true,
                    message: 'If an account exists with this email, a verification code has been sent.' 
                });
            }

            // Generate 6-digit verification code
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            // Delete any existing reset tokens for this user
            await ResetToken.deleteMany({ userId: user._id });
            
            // Save new reset token with code
            await new ResetToken({ 
                userId: user._id, 
                token: resetCode, 
                expires 
            }).save();

            // Send email with verification code
            await sendEmail(email, emailTemplates.passwordReset, user.name, resetCode);

            // Log for development
            console.log(`🔐 Password reset code for ${email}: ${resetCode}`);
            
            res.json({ 
                success: true,
                message: 'If an account exists with this email, a verification code has been sent.',
                // Include email in response for frontend use
                email: email
            });
        } catch (err) {
            console.error('Reset request error:', err);
            res.status(500).json({ 
                success: false,
                message: 'Unable to process password reset request. Please try again later.' 
            });
        }
    }
);

// Verify Reset Code
app.post('/api/verify-reset-code',
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid code format')
    ],
    handleValidation,
    async (req, res) => {
        const { email, code } = req.body;
        try {
            const user = await User.findOne({ email });
            
            if (!user) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid verification code' 
                });
            }

            const reset = await ResetToken.findOne({ 
                userId: user._id, 
                token: code, 
                expires: { $gt: new Date() } 
            });
            
            if (!reset) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid or expired verification code' 
                });
            }

            res.json({ 
                success: true,
                message: 'Code verified successfully',
                userId: user._id.toString()
            });
        } catch (err) {
            console.error('Code verification error:', err);
            res.status(500).json({ 
                success: false,
                message: 'Verification failed' 
            });
        }
    }
);

// Reset Password with Verified Code
app.post('/api/reset-password', 
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid code format'),
        body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    handleValidation,
    async (req, res) => {
        const { email, code, newPassword } = req.body;
        try {
            const user = await User.findOne({ email });
            
            if (!user) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid request' 
                });
            }

            // Verify the code one more time
            const reset = await ResetToken.findOne({ 
                userId: user._id, 
                token: code, 
                expires: { $gt: new Date() } 
            });
            
            if (!reset) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid or expired verification code' 
                });
            }

            // Hash new password and update
            const hashed = await bcrypt.hash(newPassword, 12);
            await User.findByIdAndUpdate(user._id, { password: hashed });
            
            // Delete all reset tokens for this user
            await ResetToken.deleteMany({ userId: user._id });

            // Send confirmation email
            if (transporter) {
                try {
                    await transporter.sendMail({
                        from: `"MKcode" <${process.env.SMTP_USER}>`,
                        to: email,
                        subject: 'Password Changed Successfully - MKcode',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #22c55e, #3b82f6); padding: 30px; text-align: center;">
                                    <h1 style="color: white; margin: 0;">✅ Password Changed</h1>
                                </div>
                                <div style="padding: 30px; background: #f9fafb;">
                                    <h2>Hello ${user.name}!</h2>
                                    <p>Your password has been successfully changed.</p>
                                    <p>If you did not make this change, please contact our support team immediately.</p>
                                    <a href="${process.env.FRONTEND_URL}/login.html" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Login Now</a>
                                </div>
                                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                                    <p>© ${new Date().getFullYear()} MKcode. All rights reserved.</p>
                                </div>
                            </div>
                        `
                    });
                } catch (emailErr) {
                    console.error('Failed to send confirmation email:', emailErr);
                }
            }

            console.log(`✅ Password reset successful for ${email}`);
            
            res.json({ 
                success: true,
                message: 'Password reset successful! You can now login with your new password.' 
            });
        } catch (err) {
            console.error('Password reset error:', err);
            res.status(500).json({ 
                success: false,
                message: 'Password reset failed. Please try again.' 
            });
        }
    }
);

// ===========================================
// CONTACT ROUTES
// ===========================================

// Submit Contact Form
app.post('/api/contact', 
    [
        body('name').trim().isLength({ min: 2 }).withMessage('Name required'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('subject').trim().isLength({ min: 3 }).withMessage('Subject required'),
        body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
    ],
    handleValidation,
    async (req, res) => {
        const { name, email, subject, message, priority } = req.body;
        try {
            console.log(`📝 New contact form submission from ${name} (${email})`);
            
            const contact = new Contact({ 
                name, 
                email, 
                subject, 
                message,
                priority: priority || 'medium'
            });
            await contact.save();
            console.log(`✅ Contact message saved to database`);

            // Send confirmation email to the user
            console.log(`📧 Sending confirmation email to user: ${email}`);
            await sendEmail(email, emailTemplates.contactConfirmation, name);

            // Send notification email to admin
            const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
            if (adminEmail) {
                console.log(`📧 Sending notification email to admin: ${adminEmail}`);
                await sendEmail(adminEmail, emailTemplates.contactNotification, name, email, subject, message);
            }

            res.status(201).json({ message: 'Message sent successfully. We will get back to you soon!' });
        } catch (err) {
            console.error('❌ Contact form error:', err);
            res.status(500).json({ message: 'Failed to send message' });
        }
    }
);

// ===========================================
// NEWSLETTER ROUTES
// ===========================================

// Subscribe to Newsletter
app.post('/api/newsletter', 
    [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
    handleValidation,
    async (req, res) => {
        const { email, preferences } = req.body;
        try {
            const exists = await Newsletter.findOne({ email });
            if (exists) {
                if (exists.isActive) {
                    return res.status(400).json({ message: 'Already subscribed' });
                }
                // Reactivate subscription
                exists.isActive = true;
                exists.preferences = preferences || exists.preferences;
                await exists.save();
                return res.json({ message: 'Subscription reactivated!' });
            }

            const unsubscribeToken = crypto.randomBytes(32).toString('hex');
            const sub = new Newsletter({ 
                email, 
                unsubscribeToken,
                preferences: preferences || {}
            });
            await sub.save();

            // Send welcome email
            await sendEmail(email, emailTemplates.newsletterWelcome, email);

            res.status(201).json({ message: 'Subscribed successfully!' });
        } catch (err) {
            res.status(500).json({ message: 'Subscription failed' });
        }
    }
);

// Unsubscribe from Newsletter
app.get('/api/newsletter/unsubscribe/:token', async (req, res) => {
    try {
        const sub = await Newsletter.findOne({ unsubscribeToken: req.params.token });
        if (!sub) {
            return res.status(404).json({ message: 'Invalid unsubscribe link' });
        }
        sub.isActive = false;
        await sub.save();
        res.json({ message: 'Successfully unsubscribed from newsletter' });
    } catch (err) {
        res.status(500).json({ message: 'Unsubscribe failed' });
    }
});

// ===========================================
// ADMIN ROUTES
// ===========================================

// Admin Dashboard Stats
app.get('/api/admin/stats', auth, adminAuth, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            adminUsers,
            totalMessages,
            newMessages,
            totalSubscribers,
            activeSubscribers,
            recentActivity
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            User.countDocuments({ role: 'admin' }),
            Contact.countDocuments(),
            Contact.countDocuments({ status: 'new' }),
            Newsletter.countDocuments(),
            Newsletter.countDocuments({ isActive: true }),
            ActivityLog.find().sort({ createdAt: -1 }).limit(10).populate('adminId', 'name email')
        ]);

        // Get user registration trends (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const userTrend = await User.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            users: { total: totalUsers, active: activeUsers, admins: adminUsers },
            messages: { total: totalMessages, new: newMessages },
            newsletter: { total: totalSubscribers, active: activeSubscribers },
            userTrend,
            recentActivity
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});

// Get All Users (Admin)
app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role, status } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') }
            ];
        }
        if (role) query.role = role;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        const users = await User.find(query)
            .select('-password -verificationToken')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({ users, total, pages: Math.ceil(total / limit), currentPage: parseInt(page) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// Delete User (Admin)
app.delete('/api/admin/user/:id', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        // Prevent self-deletion
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account from admin panel' });
        }

        // Delete avatar
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const avatarPath = path.join(__dirname, user.avatarUrl);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        // Clean up related data
        await ResetToken.deleteMany({ userId: user._id });
        await VerificationToken.deleteMany({ userId: user._id });

        await User.findByIdAndDelete(req.params.id);

        await logActivity(req.user.id, 'DELETE_USER', user.email, { userId: req.params.id }, req);

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Delete failed' });
    }
});

// Get All Messages (Admin)
app.get('/api/admin/messages', auth, adminAuth, async (req, res) => {
    try {
        const { status, priority, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (priority) query.priority = priority;

        const messages = await Contact.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Contact.countDocuments(query);

        res.json({ messages, total, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// Update Message Status (Admin)
app.put('/api/admin/message/:id', auth, adminAuth, async (req, res) => {
    try {
        const { status, priority, notes } = req.body;
        const update = {};
        if (status) {
            update.status = status;
            if (status === 'replied') update.repliedAt = new Date();
            update.repliedBy = req.user.id;
        }
        if (priority) update.priority = priority;
        if (notes) update.notes = notes;

        const message = await Contact.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!message) return res.status(404).json({ message: 'Message not found' });

        res.json(message);
    } catch (err) {
        res.status(500).json({ message: 'Update failed' });
    }
});

// Delete Message (Admin)
app.delete('/api/admin/message/:id', auth, adminAuth, async (req, res) => {
    try {
        const message = await Contact.findByIdAndDelete(req.params.id);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        res.json({ message: 'Message deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Delete failed' });
    }
});

// Get Newsletter Subscribers (Admin)
app.get('/api/admin/newsletter', auth, adminAuth, async (req, res) => {
    try {
        const { active, page = 1, limit = 50 } = req.query;
        const query = {};
        if (active === 'true') query.isActive = true;
        if (active === 'false') query.isActive = false;

        const subs = await Newsletter.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Newsletter.countDocuments(query);

        res.json({ subscribers: subs, total, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch subscribers' });
    }
});

// Promote User to Admin
app.post('/api/admin/promote', auth, adminAuth, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    try {
        const user = await User.findByIdAndUpdate(userId, { role: 'admin' }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        await logActivity(req.user.id, 'PROMOTE_USER', user.email, { userId, newRole: 'admin' }, req);
        
        res.json({ message: 'User promoted to admin', user });
    } catch (err) {
        res.status(500).json({ message: 'Promote failed' });
    }
});

// Demote Admin to User
app.post('/api/admin/demote', auth, adminAuth, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'admin') return res.status(400).json({ message: 'User is not an admin' });
        if (user._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot demote yourself' });
        
        user.role = 'user';
        await user.save();
        
        await logActivity(req.user.id, 'DEMOTE_USER', user.email, { userId, newRole: 'user' }, req);
        
        res.json({ message: 'User demoted to regular user', user });
    } catch (err) {
        res.status(500).json({ message: 'Demote failed' });
    }
});

// Admin Reset User Password
app.post('/api/admin/reset-password', auth, adminAuth, async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ message: 'User ID and new password required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    
    try {
        const hashed = await bcrypt.hash(password, 12);
        const user = await User.findByIdAndUpdate(userId, { password: hashed });
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        await logActivity(req.user.id, 'RESET_USER_PASSWORD', user.email, { userId }, req);
        
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Password reset failed' });
    }
});

// Toggle User Active Status (Admin)
app.post('/api/admin/toggle-status', auth, adminAuth, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID required' });
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot deactivate yourself' });
        
        user.isActive = !user.isActive;
        await user.save();
        
        await logActivity(req.user.id, user.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', user.email, { userId }, req);
        
        res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
    } catch (err) {
        res.status(500).json({ message: 'Status toggle failed' });
    }
});

// Search Users (Admin)
app.get('/api/admin/search-users', auth, adminAuth, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const regex = new RegExp(q, 'i');
        const users = await User.find({ 
            $or: [{ email: regex }, { name: regex }] 
        }).select('-password -verificationToken').limit(20);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Search failed' });
    }
});

// Get Activity Logs (Admin)
app.get('/api/admin/activity-logs', auth, adminAuth, async (req, res) => {
    try {
        const { action, adminId, page = 1, limit = 100 } = req.query;
        const query = {};
        if (action) query.action = action;
        if (adminId) query.adminId = adminId;

        const logs = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('adminId', 'email name');

        const total = await ActivityLog.countDocuments(query);

        res.json({ logs, total, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch logs' });
    }
});

// CSV Export (Admin)
app.get('/api/admin/export/:type', auth, adminAuth, async (req, res) => {
    const { type } = req.params;
    try {
        let data = [];
        let fields = [];

        if (type === 'users') {
            data = await User.find().select('-password -verificationToken').lean();
            fields = ['name', 'email', 'role', 'isActive', 'isVerified', 'createdAt', 'lastLogin'];
        } else if (type === 'messages') {
            data = await Contact.find().lean();
            fields = ['name', 'email', 'subject', 'message', 'status', 'priority', 'createdAt'];
        } else if (type === 'newsletter') {
            data = await Newsletter.find().lean();
            fields = ['email', 'isActive', 'createdAt'];
        } else {
            return res.status(400).json({ message: 'Invalid export type' });
        }

        const parser = new Parser({ fields });
        const csv = parser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${type}-export-${Date.now()}.csv`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: 'Export failed' });
    }
});

// Bulk Actions (Admin)
app.post('/api/admin/bulk-action', auth, adminAuth, async (req, res) => {
    const { action, userIds } = req.body;
    if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'Action and user IDs required' });
    }

    // Prevent self-action
    if (userIds.includes(req.user.id)) {
        return res.status(400).json({ message: 'Cannot perform bulk action on yourself' });
    }

    try {
        let result;
        switch (action) {
            case 'delete':
                result = await User.deleteMany({ _id: { $in: userIds } });
                await logActivity(req.user.id, 'BULK_DELETE_USERS', 'multiple', { count: userIds.length }, req);
                break;
            case 'activate':
                result = await User.updateMany({ _id: { $in: userIds } }, { isActive: true });
                await logActivity(req.user.id, 'BULK_ACTIVATE_USERS', 'multiple', { count: userIds.length }, req);
                break;
            case 'deactivate':
                result = await User.updateMany({ _id: { $in: userIds } }, { isActive: false });
                await logActivity(req.user.id, 'BULK_DEACTIVATE_USERS', 'multiple', { count: userIds.length }, req);
                break;
            case 'promote':
                result = await User.updateMany({ _id: { $in: userIds } }, { role: 'admin' });
                await logActivity(req.user.id, 'BULK_PROMOTE_USERS', 'multiple', { count: userIds.length }, req);
                break;
            case 'demote':
                result = await User.updateMany({ _id: { $in: userIds } }, { role: 'user' });
                await logActivity(req.user.id, 'BULK_DEMOTE_USERS', 'multiple', { count: userIds.length }, req);
                break;
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        res.json({ message: `Bulk ${action} completed`, affected: result.modifiedCount || result.deletedCount });
    } catch (err) {
        res.status(500).json({ message: 'Bulk action failed' });
    }
});

// ===========================================
// HEALTH CHECK & ROOT
// ===========================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'MKcode Backend API v1.1.0',
        docs: '/api/health for health check',
        version: '1.1.0'
    });
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Internal server error' });
});

// ===========================================
// BLOG/ARTICLE ENDPOINTS
// ===========================================

// Get all published blogs (public)
app.get('/api/blogs', async (req, res) => {
    try {
        const { category, tag, search, page = 1, limit = 10 } = req.query;
        const query = { status: 'published' };
        
        if (category) query.category = category;
        if (tag) query.tags = tag;
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { content: new RegExp(search, 'i') },
                { excerpt: new RegExp(search, 'i') }
            ];
        }
        
        const blogs = await Blog.find(query)
            .populate('author', 'name avatarUrl')
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const total = await Blog.countDocuments(query);
        
        res.json({ blogs, total, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blogs' });
    }
});

// Get single blog (public)
app.get('/api/blogs/:slug', async (req, res) => {
    try {
        const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' })
            .populate('author', 'name avatarUrl bio');
        
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        
        // Increment views
        blog.views += 1;
        await blog.save();
        
        res.json(blog);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch blog' });
    }
});

// Create blog (authenticated users)
app.post('/api/blogs', auth, [
    body('title').notEmpty().trim(),
    body('content').notEmpty(),
    body('category').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const { title, content, excerpt, category, tags, featuredImage } = req.body;
        
        // Generate slug
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Calculate read time (approx 200 words per minute)
        const wordCount = content.split(/\s+/).length;
        const readTime = Math.ceil(wordCount / 200);
        
        const blog = new Blog({
            title,
            slug: `${slug}-${Date.now()}`,
            content,
            excerpt: excerpt || content.substring(0, 200),
            author: req.user.id,
            category,
            tags: tags || [],
            featuredImage,
            readTime,
            status: 'draft'
        });
        
        await blog.save();
        res.status(201).json({ message: 'Blog created successfully', blog });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create blog' });
    }
});

// Update blog (author or admin)
app.put('/api/blogs/:id', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        
        const user = await User.findById(req.user.id);
        if (blog.author.toString() !== req.user.id && user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        
        const { title, content, excerpt, category, tags, featuredImage, status } = req.body;
        
        if (title) blog.title = title;
        if (content) {
            blog.content = content;
            const wordCount = content.split(/\s+/).length;
            blog.readTime = Math.ceil(wordCount / 200);
        }
        if (excerpt) blog.excerpt = excerpt;
        if (category) blog.category = category;
        if (tags) blog.tags = tags;
        if (featuredImage) blog.featuredImage = featuredImage;
        if (status) {
            blog.status = status;
            if (status === 'published' && !blog.publishedAt) {
                blog.publishedAt = new Date();
            }
        }
        
        await blog.save();
        res.json({ message: 'Blog updated successfully', blog });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update blog' });
    }
});

// Delete blog (author or admin)
app.delete('/api/blogs/:id', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        
        const user = await User.findById(req.user.id);
        if (blog.author.toString() !== req.user.id && user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        
        await Blog.findByIdAndDelete(req.params.id);
        await Comment.deleteMany({ blogId: req.params.id });
        
        res.json({ message: 'Blog deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete blog' });
    }
});

// Like/Unlike blog
app.post('/api/blogs/:id/like', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        
        const index = blog.likes.indexOf(req.user.id);
        if (index > -1) {
            blog.likes.splice(index, 1);
        } else {
            blog.likes.push(req.user.id);
        }
        
        await blog.save();
        res.json({ message: 'Success', likes: blog.likes.length, liked: index === -1 });
    } catch (err) {
        res.status(500).json({ message: 'Failed to process like' });
    }
});

// Get comments for a blog
app.get('/api/blogs/:id/comments', async (req, res) => {
    try {
        const comments = await Comment.find({ blogId: req.params.id, isApproved: true })
            .populate('author', 'name avatarUrl')
            .sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch comments' });
    }
});

// Add comment to blog
app.post('/api/blogs/:id/comments', auth, [
    body('content').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const { content, parentComment } = req.body;
        
        const comment = new Comment({
            blogId: req.params.id,
            author: req.user.id,
            content,
            parentComment,
            isApproved: true // Auto-approve for now
        });
        
        await comment.save();
        await comment.populate('author', 'name avatarUrl');
        
        res.status(201).json({ message: 'Comment added', comment });
    } catch (err) {
        res.status(500).json({ message: 'Failed to add comment' });
    }
});

// ===========================================
// TESTIMONIAL/REVIEW ENDPOINTS
// ===========================================

// Get all approved testimonials (public)
app.get('/api/testimonials', async (req, res) => {
    try {
        const { featured } = req.query;
        const query = { isApproved: true };
        if (featured === 'true') query.isFeatured = true;
        
        const testimonials = await Testimonial.find(query)
            .sort({ createdAt: -1 })
            .limit(featured ? 6 : 100);
        res.json(testimonials);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch testimonials' });
    }
});

// Submit testimonial
app.post('/api/testimonials', [
    body('name').notEmpty().trim(),
    body('email').isEmail(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('message').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const { name, email, company, position, rating, message, projectType } = req.body;
        
        const testimonial = new Testimonial({
            name,
            email,
            company,
            position,
            rating,
            message,
            projectType
        });
        
        await testimonial.save();
        res.status(201).json({ message: 'Thank you for your testimonial! It will be reviewed shortly.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit testimonial' });
    }
});

// Get all testimonials (admin)
app.get('/api/admin/testimonials', auth, adminAuth, async (req, res) => {
    try {
        const testimonials = await Testimonial.find().sort({ createdAt: -1 });
        res.json(testimonials);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch testimonials' });
    }
});

// Approve/reject testimonial (admin)
app.put('/api/admin/testimonials/:id', auth, adminAuth, async (req, res) => {
    try {
        const { isApproved, isFeatured, displayOnHome } = req.body;
        const testimonial = await Testimonial.findByIdAndUpdate(
            req.params.id,
            { isApproved, isFeatured, displayOnHome },
            { new: true }
        );
        res.json({ message: 'Testimonial updated', testimonial });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update testimonial' });
    }
});

// Delete testimonial (admin)
app.delete('/api/admin/testimonials/:id', auth, adminAuth, async (req, res) => {
    try {
        await Testimonial.findByIdAndDelete(req.params.id);
        res.json({ message: 'Testimonial deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete testimonial' });
    }
});

// ===========================================
// JOB POSTING & APPLICATION ENDPOINTS
// ===========================================

// Get all active jobs (public)
app.get('/api/jobs', async (req, res) => {
    try {
        const { department, type, location } = req.query;
        const query = { isActive: true };
        
        if (department) query.department = department;
        if (type) query.type = type;
        if (location) query.location = new RegExp(location, 'i');
        
        const jobs = await Job.find(query).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch jobs' });
    }
});

// Get single job (public)
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch job' });
    }
});

// Multer config for resumes
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/resumes';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const resumeUpload = multer({
    storage: resumeStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX files allowed!'));
        }
    }
});

// Apply for job
app.post('/api/jobs/:id/apply', resumeUpload.single('resume'), [
    body('applicantName').notEmpty().trim(),
    body('email').isEmail(),
    body('phone').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    if (!req.file) return res.status(400).json({ message: 'Resume is required' });
    
    try {
        const job = await Job.findById(req.params.id);
        if (!job || !job.isActive) return res.status(404).json({ message: 'Job not found' });
        
        const { applicantName, email, phone, coverLetter, portfolio, linkedin, github, experience, currentCompany, expectedSalary, noticePeriod } = req.body;
        
        const application = new Application({
            jobId: req.params.id,
            applicantName,
            email,
            phone,
            resume: req.file.path,
            coverLetter,
            portfolio,
            linkedin,
            github,
            experience,
            currentCompany,
            expectedSalary,
            noticePeriod
        });
        
        await application.save();
        
        // Increment application count
        job.applicationCount += 1;
        await job.save();
        
        // Send confirmation email if configured
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_USER,
                    to: email,
                    subject: `Application Received - ${job.title}`,
                    html: `
                        <h2>Thank you for applying!</h2>
                        <p>Dear ${applicantName},</p>
                        <p>We have received your application for the position of <strong>${job.title}</strong>.</p>
                        <p>Our team will review your application and get back to you soon.</p>
                        <p>Best regards,<br/>MKcode Team</p>
                    `
                });
            } catch (emailErr) {
                console.error('Failed to send confirmation email:', emailErr);
            }
        }
        
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit application' });
    }
});

// Create job (admin)
app.post('/api/admin/jobs', auth, adminAuth, [
    body('title').notEmpty().trim(),
    body('department').notEmpty(),
    body('location').notEmpty(),
    body('type').notEmpty(),
    body('description').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const jobData = { ...req.body, postedBy: req.user.id };
        const job = new Job(jobData);
        await job.save();
        res.status(201).json({ message: 'Job posted successfully', job });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create job' });
    }
});

// Update job (admin)
app.put('/api/admin/jobs/:id', auth, adminAuth, async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: 'Job updated', job });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update job' });
    }
});

// Get all applications (admin)
app.get('/api/admin/applications', auth, adminAuth, async (req, res) => {
    try {
        const { jobId, status } = req.query;
        const query = {};
        if (jobId) query.jobId = jobId;
        if (status) query.status = status;
        
        const applications = await Application.find(query)
            .populate('jobId', 'title department')
            .sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch applications' });
    }
});

// Update application status (admin)
app.put('/api/admin/applications/:id', auth, adminAuth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const application = await Application.findByIdAndUpdate(
            req.params.id,
            { status, notes, reviewedBy: req.user.id },
            { new: true }
        );
        res.json({ message: 'Application updated', application });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update application' });
    }
});

// ===========================================
// FAQ ENDPOINTS
// ===========================================

// Get all active FAQs (public)
app.get('/api/faqs', async (req, res) => {
    try {
        const { category } = req.query;
        const query = { isActive: true };
        if (category) query.category = category;
        
        const faqs = await FAQ.find(query).sort({ order: 1, createdAt: -1 });
        res.json(faqs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch FAQs' });
    }
});

// Search FAQs
app.get('/api/faqs/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        
        const regex = new RegExp(q, 'i');
        const faqs = await FAQ.find({
            isActive: true,
            $or: [
                { question: regex },
                { answer: regex }
            ]
        }).limit(10);
        
        res.json(faqs);
    } catch (err) {
        res.status(500).json({ message: 'Failed to search FAQs' });
    }
});

// Mark FAQ as helpful
app.post('/api/faqs/:id/helpful', async (req, res) => {
    try {
        const { helpful } = req.body; // true or false
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ message: 'FAQ not found' });
        
        if (helpful) {
            faq.helpful += 1;
        } else {
            faq.notHelpful += 1;
        }
        faq.views += 1;
        
        await faq.save();
        res.json({ message: 'Feedback recorded' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to record feedback' });
    }
});

// Create FAQ (admin)
app.post('/api/admin/faqs', auth, adminAuth, [
    body('question').notEmpty().trim(),
    body('answer').notEmpty().trim(),
    body('category').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const faq = new FAQ(req.body);
        await faq.save();
        res.status(201).json({ message: 'FAQ created', faq });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create FAQ' });
    }
});

// Update FAQ (admin)
app.put('/api/admin/faqs/:id', auth, adminAuth, async (req, res) => {
    try {
        const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: 'FAQ updated', faq });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update FAQ' });
    }
});

// Delete FAQ (admin)
app.delete('/api/admin/faqs/:id', auth, adminAuth, async (req, res) => {
    try {
        await FAQ.findByIdAndDelete(req.params.id);
        res.json({ message: 'FAQ deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete FAQ' });
    }
});

// ===========================================
// NOTIFICATION ENDPOINTS
// ===========================================

// Get user notifications
app.get('/api/notifications', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
        res.json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({ _id: req.params.id, userId: req.user.id });
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
        
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notification' });
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update notifications' });
    }
});

// Delete notification
app.delete('/api/notifications/:id', auth, async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete notification' });
    }
});

// Create notification (admin or system)
app.post('/api/admin/notifications', auth, adminAuth, [
    body('userId').notEmpty(),
    body('title').notEmpty().trim(),
    body('message').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    try {
        const notification = new Notification(req.body);
        await notification.save();
        res.status(201).json({ message: 'Notification created', notification });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create notification' });
    }
});

// ===========================================
// ANALYTICS ENDPOINTS
// ===========================================

// Track page view
app.post('/api/analytics/track', async (req, res) => {
    try {
        const { page, sessionId, referrer, actions, duration } = req.body;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        let userId = null;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (err) {
                // Guest user
            }
        }
        
        const analytics = new Analytics({
            page,
            userId,
            sessionId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            referrer,
            actions,
            duration
        });
        
        await analytics.save();
        res.json({ message: 'Tracked' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to track' });
    }
});

// Get analytics data (admin)
app.get('/api/admin/analytics', auth, adminAuth, async (req, res) => {
    try {
        const { startDate, endDate, page } = req.query;
        const query = {};
        
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (page) query.page = page;
        
        const analytics = await Analytics.find(query).sort({ createdAt: -1 }).limit(1000);
        
        // Aggregate data
        const pageViews = await Analytics.aggregate([
            { $match: query },
            { $group: { _id: '$page', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
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

// ===========================================
// START SERVER
// ===========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

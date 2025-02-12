const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const passport = require('passport');
const express = require('express');
const session = require('express-session');
const authRouter = require('../src/routes/auth');

describe('Authentication Routes', () => {
    let app;
    let authenticateStub;
    let mockUser;
    let serializeUserStub;
    let deserializeUserStub;

    beforeEach(() => {
        // Create express app for testing
        app = express();
        
        // Configure session middleware for testing
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false
        }));
        
        // Initialize passport
        app.use(passport.initialize());
        app.use(passport.session());
        
        // Setup mock user
        mockUser = {
            id: '123',
            name: 'Test User',
            email: 'test@example.com',
            picture: 'https://example.com/photo.jpg'
        };

        // Setup authentication stub
        authenticateStub = sinon.stub(passport, 'authenticate').returns((req, res, next) => next());
        
        // Setup serialize/deserialize stubs
        serializeUserStub = sinon.stub(passport, 'serializeUser')
            .callsFake((user, done) => done(null, user.id));
        deserializeUserStub = sinon.stub(passport, 'deserializeUser')
            .callsFake((id, done) => done(null, mockUser));
        
        // Mount auth router
        app.use('/auth', authRouter);
    });

    afterEach(() => {
        authenticateStub.restore();
        sinon.restore();
    });

    describe('GET /auth/google', () => {
        it('should initiate Google OAuth2 authentication', async () => {
            const response = await request(app)
                .get('/auth/google')
                .expect(302);

            expect(authenticateStub.calledOnce).to.be.true;
            expect(authenticateStub.firstCall.args[0]).to.equal('google');
            expect(authenticateStub.firstCall.args[1].scope).to.deep.equal(['profile', 'email']);
        });

        it('should handle authentication errors gracefully', async () => {
            authenticateStub.throws(new Error('Strategy error'));
            
            const response = await request(app)
                .get('/auth/google')
                .expect(500);

            expect(response.body.error).to.equal('Authentication error occurred');
        });
    });

    describe('GET /auth/google/callback', () => {
        it('should handle successful authentication callback', async () => {
            const response = await request(app)
                .get('/auth/google/callback')
                .expect(302);

            expect(authenticateStub.calledOnce).to.be.true;
            expect(response.header.location).to.equal('/dashboard');
        });

        it('should redirect to login on authentication failure', async () => {
            authenticateStub.returns((req, res) => res.redirect('/login'));

            const response = await request(app)
                .get('/auth/google/callback')
                .expect(302);

            expect(response.header.location).to.equal('/login');
        });
    });

    describe('GET /auth/status', () => {
        it('should return authentication status for authenticated user', async () => {
            const req = {
                isAuthenticated: () => true,
                user: mockUser
            };

            app.use('/auth/status', (req, res, next) => {
                req.isAuthenticated = () => true;
                req.user = mockUser;
                next();
            });

            const response = await request(app)
                .get('/auth/status')
                .expect(200);

            expect(response.body).to.deep.equal({
                isAuthenticated: true,
                user: mockUser
            });
        });

        it('should handle unauthenticated requests', async () => {
            const response = await request(app)
                .get('/auth/status')
                .expect(401);
        });

        it('should handle missing user data', async () => {
            app.use('/auth/status', (req, res, next) => {
                req.isAuthenticated = () => true;
                req.user = null;
                next();
            });

            const response = await request(app)
                .get('/auth/status')
                .expect(500);

            expect(response.body.error).to.equal('Authentication error occurred');
        });

        it('should validate user session correctly', async () => {
            const validateSessionStub = sinon.stub().callsFake((req, res, next) => next());
            app.use('/auth/status', validateSessionStub, (req, res, next) => {
                req.isAuthenticated = () => true;
                req.user = mockUser;
                next();
            });

            await request(app)
                .get('/auth/status')
                .expect(200);

            expect(validateSessionStub.calledOnce).to.be.true;
        });
    });

    describe('GET /auth/logout', () => {
        it('should successfully logout user', async () => {
            app.use('/auth/logout', (req, res, next) => {
                req.logout = (callback) => callback();
                next();
            });

            const response = await request(app)
                .get('/auth/logout')
                .expect(302);

            expect(response.header.location).to.equal('/');
        });

        it('should handle logout errors', async () => {
            app.use('/auth/logout', (req, res, next) => {
                req.logout = (callback) => callback(new Error('Logout failed'));
                next();
            });

            const response = await request(app)
                .get('/auth/logout')
                .expect(500);

            expect(response.body).to.deep.equal({
                error: 'Error during logout'
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle authentication errors', async () => {
            // Simulate an authentication error
            app.use('/auth/error-test', (req, res, next) => {
                next(new Error('Authentication failed'));
            });

            const response = await request(app)
                .get('/auth/error-test')
                .expect(500);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.equal('Authentication error occurred');
        });
    });

    describe('Session Management', () => {
        it('should serialize user correctly', (done) => {
            passport.serializeUser(mockUser, (err, id) => {
                expect(err).to.be.null;
                expect(id).to.equal(mockUser.id);
                done();
            });
        });

        it('should deserialize user correctly', (done) => {
            passport.deserializeUser(mockUser.id, (err, user) => {
                expect(err).to.be.null;
                expect(user).to.deep.equal(mockUser);
                done();
            });
        });

        it('should maintain session across requests', async () => {
            const agent = request.agent(app);
            
            // Simulate login
            app.use('/auth/fake-login', (req, res, next) => {
                req.login(mockUser, (err) => {
                    if (err) return next(err);
                    res.sendStatus(200);
                });
            });

            // Login
            await agent
                .get('/auth/fake-login')
                .expect(200);

            // Check status
            const response = await agent
                .get('/auth/status')
                .expect(200);

            expect(response.body.isAuthenticated).to.be.true;
            expect(response.body.user).to.deep.equal(mockUser);
        });
    });
});

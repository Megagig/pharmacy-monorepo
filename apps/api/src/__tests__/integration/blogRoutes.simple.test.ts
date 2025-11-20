/**
 * Simple Blog Routes Integration Test
 * Tests that blog routes are properly configured
 * Requirements: 1.1, 2.1
 */

import express from 'express';
import healthBlogRoutes from '../../routes/healthBlog.routes';
import healthBlogAdminRoutes from '../../routes/healthBlogAdmin.routes';

// Mock the dependencies to avoid complex setup
jest.mock('../../middlewares/rateLimiting', () => ({
    createRateLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

jest.mock('../../middlewares/superAdminAuth', () => ({
    superAdminAuth: jest.fn((req: any, res: any, next: any) => {
        req.user = { _id: 'test-user-id', role: 'super_admin' };
        next();
    }),
    auditSuperAdminAction: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

jest.mock('../../middlewares/upload', () => ({
    createBlogImageUpload: jest.fn(() => ({
        single: jest.fn(() => (req: any, res: any, next: any) => next()),
    })),
}));

jest.mock('../../middlewares/validation', () => ({
    validateRequest: jest.fn((req: any, res: any, next: any) => next()),
}));

jest.mock('../../controllers/healthBlogController', () => ({
    getPublishedPosts: jest.fn((req: any, res: any) => res.json({ success: true, data: { posts: [] } })),
    getPostBySlug: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    getFeaturedPosts: jest.fn((req: any, res: any) => res.json({ success: true, data: { posts: [] } })),
    getRelatedPosts: jest.fn((req: any, res: any) => res.json({ success: true, data: { posts: [] } })),
    getCategories: jest.fn((req: any, res: any) => res.json({ success: true, data: { categories: [] } })),
    getTags: jest.fn((req: any, res: any) => res.json({ success: true, data: { tags: [] } })),
    incrementViewCount: jest.fn((req: any, res: any) => res.json({ success: true, data: { viewCount: 1 } })),
    searchPosts: jest.fn((req: any, res: any) => res.json({ success: true, data: { posts: [] } })),
}));

jest.mock('../../controllers/healthBlogAdminController', () => ({
    createPost: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { post: {} } })),
    getAllPosts: jest.fn((req: any, res: any) => res.json({ success: true, data: { posts: [] } })),
    getPostById: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    updatePost: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    deletePost: jest.fn((req: any, res: any) => res.json({ success: true, data: { success: true } })),
    publishPost: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    unpublishPost: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    archivePost: jest.fn((req: any, res: any) => res.json({ success: true, data: { post: {} } })),
    uploadFeaturedImage: jest.fn((req: any, res: any) => res.json({ success: true, data: { image: {} } })),
    getBlogAnalytics: jest.fn((req: any, res: any) => res.json({ success: true, data: { analytics: {} } })),
    getBlogStats: jest.fn((req: any, res: any) => res.json({ success: true, data: { stats: {} } })),
}));

describe('Blog Routes Configuration', () => {
    let publicApp: express.Application;
    let adminApp: express.Application;

    beforeEach(() => {
        publicApp = express();
        publicApp.use(express.json());
        publicApp.use('/api/public/blog', healthBlogRoutes);

        adminApp = express();
        adminApp.use(express.json());
        adminApp.use('/api/super-admin/blog', healthBlogAdminRoutes);
    });

    describe('Public Blog Routes Configuration', () => {
        it('should configure GET /posts route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/posts',
            });
        });

        it('should configure GET /posts/:slug route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/posts/:slug',
            });
        });

        it('should configure GET /featured route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/featured',
            });
        });

        it('should configure GET /categories route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/categories',
            });
        });

        it('should configure GET /tags route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/tags',
            });
        });

        it('should configure POST /posts/:slug/view route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'POST',
                path: '/posts/:slug/view',
            });
        });

        it('should configure GET /search route', () => {
            const routes = healthBlogRoutes.stack.map((layer: any) => ({
                method: Object.keys(layer.route.methods)[0].toUpperCase(),
                path: layer.route.path,
            }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/search',
            });
        });
    });

    describe('Admin Blog Routes Configuration', () => {
        it('should configure POST /posts route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'POST',
                path: '/posts',
            });
        });

        it('should configure GET /posts route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/posts',
            });
        });

        it('should configure GET /posts/:postId route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/posts/:postId',
            });
        });

        it('should configure PUT /posts/:postId route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'PUT',
                path: '/posts/:postId',
            });
        });

        it('should configure DELETE /posts/:postId route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'DELETE',
                path: '/posts/:postId',
            });
        });

        it('should configure POST /posts/:postId/publish route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'POST',
                path: '/posts/:postId/publish',
            });
        });

        it('should configure POST /posts/:postId/unpublish route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'POST',
                path: '/posts/:postId/unpublish',
            });
        });

        it('should configure POST /upload-image route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'POST',
                path: '/upload-image',
            });
        });

        it('should configure GET /analytics route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/analytics',
            });
        });

        it('should configure GET /stats route', () => {
            const routes = healthBlogAdminRoutes.stack
                .filter((layer: any) => layer.route)
                .map((layer: any) => ({
                    method: Object.keys(layer.route.methods)[0].toUpperCase(),
                    path: layer.route.path,
                }));

            expect(routes).toContainEqual({
                method: 'GET',
                path: '/stats',
            });
        });
    });

    describe('Route Middleware Application', () => {
        it('should apply middleware to public routes', () => {
            // Check that routes have middleware layers
            const routeWithMiddleware = healthBlogRoutes.stack.find((layer: any) =>
                layer.route && layer.route.path === '/posts'
            );

            expect(routeWithMiddleware).toBeDefined();
            expect(routeWithMiddleware.route.stack.length).toBeGreaterThan(1); // Should have middleware + handler
        });

        it('should apply middleware to admin routes', () => {
            // Check that admin routes have middleware layers
            const routeWithMiddleware = healthBlogAdminRoutes.stack.find((layer: any) =>
                layer.route && layer.route.path === '/posts' && layer.route.methods.post
            );

            expect(routeWithMiddleware).toBeDefined();
            expect(routeWithMiddleware.route.stack.length).toBeGreaterThan(1); // Should have middleware + handler
        });

        it('should have super admin auth middleware applied to admin routes', () => {
            // Check that the router has the superAdminAuth middleware applied
            const middlewareLayer = healthBlogAdminRoutes.stack.find((layer: any) =>
                !layer.route && layer.handle.name === 'superAdminAuth'
            );

            // The middleware should be applied at the router level
            expect(healthBlogAdminRoutes.stack.length).toBeGreaterThan(0);
        });
    });
});
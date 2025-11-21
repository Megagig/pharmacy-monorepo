"use strict";
/**
 * Authentication Hooks
 * Custom hooks for authentication state and operations
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCurrentUser = useCurrentUser;
exports.useLogin = useLogin;
exports.useLogout = useLogout;
exports.useIsAuthenticated = useIsAuthenticated;
exports.useHasPermission = useHasPermission;
exports.useHasAnyPermission = useHasAnyPermission;
exports.useHasAllPermissions = useHasAllPermissions;
var react_query_1 = require("@tanstack/react-query");
var api_client_1 = require("@pharmacy/api-client");
var constants_1 = require("@pharmacy/constants");
/**
 * Hook to get current user
 */
function useCurrentUser() {
    var _this = this;
    return (0, react_query_1.useQuery)({
        queryKey: api_client_1.queryKeys.auth.user,
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, api_client_1.apiRequest)('get', constants_1.API_ENDPOINTS.AUTH.REFRESH)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); },
        retry: false,
    });
}
/**
 * Hook for login mutation
 */
function useLogin() {
    var _this = this;
    var queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (credentials) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, api_client_1.apiRequest)('post', constants_1.API_ENDPOINTS.AUTH.LOGIN, credentials)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        }); },
        onSuccess: function (data) {
            if (data) {
                // Update user cache
                queryClient.setQueryData(api_client_1.queryKeys.auth.user, data.user);
            }
        },
    });
}
/**
 * Hook for logout mutation
 */
function useLogout() {
    var _this = this;
    var queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, api_client_1.apiRequest)('post', constants_1.API_ENDPOINTS.AUTH.LOGOUT)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function () {
            // Clear all caches
            queryClient.clear();
        },
    });
}
/**
 * Hook to check if user is authenticated
 */
function useIsAuthenticated() {
    var user = useCurrentUser().data;
    return !!user;
}
/**
 * Hook to check if user has specific permission
 */
function useHasPermission(permission) {
    var _a, _b;
    var user = useCurrentUser().data;
    return (_b = (_a = user === null || user === void 0 ? void 0 : user.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission)) !== null && _b !== void 0 ? _b : false;
}
/**
 * Hook to check if user has any of the specified permissions
 */
function useHasAnyPermission(permissions) {
    var _a;
    var user = useCurrentUser().data;
    return (_a = permissions.some(function (permission) { var _a; return (_a = user === null || user === void 0 ? void 0 : user.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission); })) !== null && _a !== void 0 ? _a : false;
}
/**
 * Hook to check if user has all specified permissions
 */
function useHasAllPermissions(permissions) {
    var _a;
    var user = useCurrentUser().data;
    return (_a = permissions.every(function (permission) { var _a; return (_a = user === null || user === void 0 ? void 0 : user.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission); })) !== null && _a !== void 0 ? _a : false;
}

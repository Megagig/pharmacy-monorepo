/// <reference types="multer" />
import 'express';
import { BaseUser, ExtendedUser } from './auth';

declare global {
    namespace Express {
        interface Request {
            user?: BaseUser | ExtendedUser;
            sessionId?: string;
            file?: Multer.File;
            files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
        }
    }
}

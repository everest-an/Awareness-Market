import { createExpressApp } from "../server/_core/index";

let appCache: any = null;

export default async function handler(req: any, res: any) {
    if (!appCache) {
        const { app } = await createExpressApp();
        appCache = app;
    }

    return appCache(req, res);
}

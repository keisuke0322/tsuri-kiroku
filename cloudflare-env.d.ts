declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare namespace Cloudflare {
  interface Env {
    APP_ORIGIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    DEMO_OWNER_ID?: string;
    PHOTO_STORAGE_GLOBAL_LIMIT_BYTES?: string;
    PHOTO_STORAGE_USER_LIMIT_BYTES?: string;
  }
}

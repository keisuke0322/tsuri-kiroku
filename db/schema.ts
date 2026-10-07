import {sql} from 'drizzle-orm';
import { integer, real, sqliteTable, text, index, primaryKey, check } from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),displayName:text('display_name').notNull(),bio:text('bio').notNull().default('')});
export const dataMigrations=sqliteTable('data_migrations',{name:text('name').primaryKey(),ownerId:text('owner_id').notNull()});
export const catches=sqliteTable('catches',{
 photosDeleting:integer('photos_deleting').notNull().default(0),ownerId:text('owner_id').references(()=>profiles.userId),id:integer('id').primaryKey({autoIncrement:true}),date:text('date').notNull(),location:text('location').notNull(),species:text('species').notNull(),count:integer('count').notNull(),length:real('length'),method:text('method').notNull().default(''),memo:text('memo').notNull().default(''),created_at:text('created_at').notNull().default(''),featuredPhotoId:integer('featured_photo_id')
},table=>[index('idx_catches_owner_date').on(table.ownerId,table.date)]);
export const catchFish=sqliteTable('catch_fish',{
 id:integer('id').primaryKey({autoIncrement:true}),catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),species:text('species').notNull(),count:integer('count').notNull(),length:real('length'),sortOrder:integer('sort_order').notNull()
},table=>[index('idx_catch_fish_catch_id').on(table.catchId),index('idx_catch_fish_species').on(table.species)]);
export const catchPhotos=sqliteTable('catch_photos',{
 id:integer('id').primaryKey({autoIncrement:true}),
 catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),
 objectKey:text('object_key').notNull(),
 contentType:text('content_type').notNull(),
 createdAt:text('created_at').notNull(),
 species:text('species')
},table=>[index('idx_catch_photos_catch_id').on(table.catchId)]);

export const catchLikes=sqliteTable('catch_likes',{catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.userId,{onDelete:'cascade'})},table=>[primaryKey({columns:[table.catchId,table.userId]})]);

export const authSessions=sqliteTable('auth_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>profiles.userId,{onDelete:'cascade'}),expiresAt:integer('expires_at').notNull()},table=>[index('idx_auth_sessions_expires').on(table.expiresAt)]);
export const oauthTransactions=sqliteTable('oauth_transactions',{stateHash:text('state_hash').primaryKey(),verifier:text('verifier').notNull(),nonce:text('nonce').notNull(),expiresAt:integer('expires_at').notNull()},table=>[index('idx_oauth_transactions_expires').on(table.expiresAt)]);

// The usage triggers and reservation/attachment guards are in 0005_photo_storage.sql.
export const photoStorageSettings=sqliteTable('photo_storage_settings',{
 id:integer('id').primaryKey(),initialized:integer('initialized').notNull().default(0),
 maintenance:integer('maintenance').notNull().default(0),inventoryCursor:text('inventory_cursor'),
 usedBytes:integer('used_bytes').notNull().default(0),
 globalLimitBytes:integer('global_limit_bytes').notNull().default(8000000000),
 userLimitBytes:integer('user_limit_bytes').notNull().default(100000000)
},table=>[check('photo_settings_singleton',sql`${table.id}=1`),check('photo_settings_used',sql`${table.usedBytes}>=0`),check('photo_settings_global',sql`${table.globalLimitBytes}>=0`),check('photo_settings_user',sql`${table.userLimitBytes}>=0`)]);
export const photoStorageUsers=sqliteTable('photo_storage_users',{
 ownerId:text('owner_id').primaryKey(),usedBytes:integer('used_bytes').notNull().default(0)
},table=>[check('photo_user_used',sql`${table.usedBytes}>=0`)]);
export const photoStorageObjects=sqliteTable('photo_storage_objects',{
 objectKey:text('object_key').primaryKey(),ownerId:text('owner_id'),catchId:integer('catch_id'),
 byteSize:integer('byte_size').notNull(),state:text('state',{enum:['reserved','stored','deleting']}).notNull(),
 inventorySeen:integer('inventory_seen').notNull().default(0),createdAt:text('created_at').notNull()
},table=>[index('idx_photo_storage_owner').on(table.ownerId),index('idx_photo_storage_catch').on(table.catchId),index('idx_photo_storage_state').on(table.state),check('photo_object_size',sql`${table.byteSize}>=0`),check('photo_object_state',sql`${table.state} IN ('reserved','stored','deleting')`)]);

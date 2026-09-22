import { integer, real, sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),displayName:text('display_name').notNull(),bio:text('bio').notNull().default('')});
export const dataMigrations=sqliteTable('data_migrations',{name:text('name').primaryKey(),ownerId:text('owner_id').notNull()});
export const catches=sqliteTable('catches',{
 ownerId:text('owner_id').references(()=>profiles.userId),id:integer('id').primaryKey({autoIncrement:true}),date:text('date').notNull(),location:text('location').notNull(),species:text('species').notNull(),count:integer('count').notNull(),length:real('length'),method:text('method').notNull().default(''),memo:text('memo').notNull().default(''),created_at:text('created_at').notNull().default('')
},table=>[index('idx_catches_owner_date').on(table.ownerId,table.date)]);
export const catchPhotos=sqliteTable('catch_photos',{
 id:integer('id').primaryKey({autoIncrement:true}),
 catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),
 objectKey:text('object_key').notNull(),
 contentType:text('content_type').notNull(),
 createdAt:text('created_at').notNull()
},table=>[index('idx_catch_photos_catch_id').on(table.catchId)]);

export const catchLikes=sqliteTable('catch_likes',{catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.userId,{onDelete:'cascade'})},table=>[primaryKey({columns:[table.catchId,table.userId]})]);

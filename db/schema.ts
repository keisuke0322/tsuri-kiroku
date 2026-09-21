import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const catches=sqliteTable('catches',{
 id:integer('id').primaryKey({autoIncrement:true}),date:text('date').notNull(),location:text('location').notNull(),species:text('species').notNull(),count:integer('count').notNull(),length:real('length'),method:text('method').notNull().default(''),memo:text('memo').notNull().default(''),created_at:text('created_at').notNull().default('')
});
export const catchPhotos=sqliteTable('catch_photos',{
 id:integer('id').primaryKey({autoIncrement:true}),
 catchId:integer('catch_id').notNull().references(()=>catches.id,{onDelete:'cascade'}),
 objectKey:text('object_key').notNull(),
 contentType:text('content_type').notNull(),
 createdAt:text('created_at').notNull()
},table=>[index('idx_catch_photos_catch_id').on(table.catchId)]);

import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const catches=sqliteTable('catches',{
 id:integer('id').primaryKey({autoIncrement:true}),date:text('date').notNull(),location:text('location').notNull(),species:text('species').notNull(),count:integer('count').notNull(),length:real('length'),method:text('method').notNull().default(''),memo:text('memo').notNull().default(''),created_at:text('created_at').notNull().default('')
});

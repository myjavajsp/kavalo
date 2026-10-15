import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    category: z.string(),
    image: z.string(),
    description: z.string(),
    readTime: z.string().optional(),
    tests: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    author: z.string().default('Equipo LGD'),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().optional().default(false),
    affiliateContext: z.enum(['lemon', 'binance', 'ripio', 'bitso', 'wise', 'belo', 'all']).optional(),
  }),
});

export const collections = { blog };

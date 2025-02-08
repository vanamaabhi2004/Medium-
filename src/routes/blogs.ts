import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { jwt } from "hono/jwt";

export const blogRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

const getPrisma = (c: any) => {
  return new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
};

blogRouter.use("/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

  try {
    const token = authHeader.split(" ")[1];
    const payload = await jwt.verify(token, c.env.JWT_SECRET);
    c.set("userId", payload.id);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 403);
  }
});

blogRouter.post("/", async (c) => {
  const prisma = getPrisma(c);
  const userId = c.get("userId");
  const { title, content } = await c.req.json();

  const post = await prisma.blog.create({
    data: { title, content, authorId: userId },
  });

  return c.json({ id: post.id });
});

blogRouter.get("/", async (c) => {
  const prisma = getPrisma(c);
  const posts = await prisma.blog.findMany();
  return c.json(posts);
});

blogRouter.get("/:id", async (c) => {
  const prisma = getPrisma(c);
  const postId = c.req.param("id");

  const post = await prisma.blog.findUnique({ where: { id: postId } });
  return post ? c.json(post) : c.json({ error: "Not found" }, 404);
});

blogRouter.put("/:id", async (c) => {
  const prisma = getPrisma(c);
  const userId = c.get("userId");
  const postId = c.req.param("id");
  const { title, content } = await c.req.json();

  const post = await prisma.blog.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  const updatedPost = await prisma.blog.update({
    where: { id: postId },
    data: { title, content },
  });

  return c.json({ message: "Updated", updatedPost });
});

blogRouter.delete("/:id", async (c) => {
  const prisma = getPrisma(c);
  const userId = c.get("userId");
  const postId = c.req.param("id");

  const post = await prisma.blog.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== userId) return c.json({ error: "Unauthorized" }, 403);

  await prisma.blog.delete({ where: { id: postId } });
  return c.json({ message: "Deleted" });
});

// TypeScript-only rules: the any type and non-null assertions.

interface User { name?: string; tags?: string[] }

function greet(user: any): string {
  return 'Hello, ' + user!.name;
}

function firstTag(user: User | undefined) {
  return user!.tags![0];
}

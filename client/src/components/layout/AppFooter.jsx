export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex items-center justify-center px-4 py-4 type-meta text-muted-foreground ">
      © 2024–{currentYear} JS E&E CO., LTD. All rights reserved.
    </footer>
  );
}

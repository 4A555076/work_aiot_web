import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BaseTab({
  value,
  onChange,
  items = [],
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className="w-auto">
      <TabsList>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
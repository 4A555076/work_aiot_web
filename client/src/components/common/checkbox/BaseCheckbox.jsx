import { Checkbox } from "@/components/ui/checkbox";

export default function BaseCheckbox({
  value = [],
  onChange,
  items = [],
  multiple = true,
}) {
  const handleCheckedChange = (checked, itemValue) => {
    if (multiple) {
      if (checked) {
        onChange([...value, itemValue]);
      } else {
        onChange(value.filter((v) => v !== itemValue));
      }
    } else {
      // 單選
      onChange(checked ? [itemValue] : []);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <label
          key={item.value}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Checkbox
            checked={value.includes(item.value)}
            onCheckedChange={(checked) =>
              handleCheckedChange(checked, item.value)
            }
          />
          <span className="type-body ">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

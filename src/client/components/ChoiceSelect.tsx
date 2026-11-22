import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";

/** A select over a fixed set of choices, keyed by value with their labels. */
export function ChoiceSelect<T extends string>({
  id,
  testId,
  value,
  options,
  onChange,
  placeholder,
}: {
  id?: string;
  testId: string;
  value: T | null;
  options: Record<T, string>;
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const items = Object.entries(options).map(([key, label]) => ({
    value: key,
    label: label as string,
  }));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
    >
      <SelectTrigger id={id} data-testid={testId} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

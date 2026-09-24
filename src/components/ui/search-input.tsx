import { MagnifyingGlassIcon } from "./icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "./icon";
import { Input, type InputProps } from "./input";

export type SearchInputProps = Omit<InputProps, "type" | "leadingIcon">;

export function SearchInput({ enterKeyHint = "search", ...props }: SearchInputProps) {
  return (
    <Input
      type="search"
      enterKeyHint={enterKeyHint}
      leadingIcon={
        <MagnifyingGlassIcon size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} />
      }
      {...props}
    />
  );
}

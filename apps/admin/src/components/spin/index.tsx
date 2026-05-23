import { NP, NSpace, NSpin } from "naive-ui";

export const CenterSpin = (props: { description?: string }) => (
  <div class="flex items-center bottom-0 left-0 right-0 top-0 justify-center absolute">
    <NSpace vertical align="center">
      <NSpin strokeWidth={14} show rotate />
      {props.description && <NP>{props.description}</NP>}
    </NSpace>
  </div>
);

CenterSpin.props = ["description"];

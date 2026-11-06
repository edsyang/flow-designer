import { isValidElement, useEffect, useReducer } from "react";
import { DisplayType } from "./ui-settings";
import { UiSetting } from "./ui-setting";
import { useMemo } from "react";
import type { UiContributionRegistry } from "./ui-contributions";
import type { Setting } from "@flow-designer/model";
import type { SettingsPanelProps, SettingFieldProps } from "./types";
import { Field } from "./field";
import { createContent, isReactComponent } from "./create-content";
import styles from "./settings.module.less";

export function SettingsPanel(props: SettingsPanelProps) {
  const settings = props.settings ?? props.node?.getSettings();
  if (!settings) {
    return null;
  }

  const items = settings.getItems();

  return (
    <div className={styles.settings}>
      {items.map((setting: Setting<unknown>) => (
        <SettingField key={setting.getId()} setting={setting} contributions={props.contributions} />
      ))}
    </div>
  );
}

export function SettingField(props: SettingFieldProps) {
  const { className, contributions } = props;
  const config = contributions?.getField(props.setting.getKey());
  const setting = useMemo(
    () => new UiSetting(props.setting, config ?? {}),
    [props.setting, config],
  );
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const detach = setting.onBehaviorChange(() => {
      forceUpdate();
    });
    setting.updateBehavior();
    return detach;
  }, [setting]);

  const display = setting.getDisplay();

  if (display === DisplayType.None) {
    return null;
  }

  const changeBehavior = (field: string, flag: boolean) => {
    setting.setBehavior(field, flag);
  };

  if (setting.isGroup()) {
    const childSettings = setting.value
      .getItems()
      .map((item) => (
        <SettingField key={item.getId()} setting={item} contributions={contributions} />
      ));

    return (
      <Field
        display={display}
        title={setting.getDescription() || ""}
        tip={setting.getTip()}
        behaviors={setting.getBehaviors()}
        isGroup
        className={className}
        onBehaviorChange={changeBehavior}
      >
        {childSettings}
      </Field>
    );
  }

  return (
    <Field
      display={display}
      title={setting.getDescription() || ""}
      tip={setting.getTip()}
      behaviors={setting.getBehaviors()}
      isGroup={false}
      className={className}
      onBehaviorChange={changeBehavior}
    >
      <SetterRenderer setting={setting} contributions={contributions} />
    </Field>
  );
}

function SetterRenderer(props: { setting: UiSetting; contributions?: UiContributionRegistry }) {
  const { setting } = props;
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const detachValue = setting.onValueChange(() => {
      forceUpdate();
    });
    const changeableProps = setting.getSetterChangeableProps();
    const detachFns = changeableProps
      ? changeableProps.map((changeable) =>
          changeable.listen(() => {
            forceUpdate();
          }),
        )
      : [];
    return () => {
      detachValue();
      detachFns.forEach((off: () => void) => {
        off();
      });
    };
  }, [setting]);

  let setter = setting.getSetter();
  if (!setter) {
    return null;
  }

  const changeableProps = setting.getSetterChangeableProps();
  const computedProps: Record<string, unknown> = {};
  if (changeableProps) {
    changeableProps.forEach((changeable) => {
      computedProps[changeable.getName()] = changeable.getComputed();
    });
  }
  computedProps.setting = setting;
  computedProps.prop = setting;
  computedProps.field = setting;
  computedProps.value = setting.getValue();
  computedProps.onChange = (newValue: unknown) => {
    setting.setValue(newValue);
  };

  if (isValidElement(setter) || isReactComponent(setter))
    return createContent(setter, computedProps);

  if (typeof setter === "string") {
    setter = { type: setter };
  }

  if (typeof setter === "object" && setter !== null && "type" in setter) {
    const {
      type,
      props: setterProps,
      ...extraProps
    } = setter as { type: string; props?: Record<string, unknown> };
    const setterType = props.contributions?.setters.getSetter(type);
    if (!setterType) {
      return null;
    }
    return createContent(setterType, {
      ...extraProps,
      ...setterProps,
      ...computedProps,
    });
  }

  const defaultSetter = props.contributions?.setters.getDefaultSetter();
  if (defaultSetter) {
    return createContent(defaultSetter, computedProps);
  }

  return null;
}

const PARAMETER_COUNT = 8;

export const createStationModelOptions = (modelData = []) => {
  
  const models = Array.isArray(modelData)
    ? modelData
    : [modelData];

  const parameters = models.flatMap((model) =>
    Array.from({ length: PARAMETER_COUNT }, (_, offset) => {
      const index = offset + 1;
      const name = model?.[`ParName${index}`];

      if (!name) return null;

      return {
        index,
        name,
        unit: model?.[`ParUnit${index}`] || "",
        countLabel: model?.[`ParName${index}Count`] || "",
      };
    }).filter(Boolean)
  );

  const valueOptions = parameters.map((parameter) => ({
    value: `Value${parameter.index}`,
    label: parameter.unit
      ? `${parameter.name} (${parameter.unit})`
      : parameter.name,
    name: parameter.name,
    unit: parameter.unit,
    type: "value",
  }));

  const countOptions = parameters
    .filter((parameter) => parameter.countLabel)
    .map((parameter) => ({
      value: `Count${parameter.index}`,
      label: parameter.countLabel,
      name: parameter.countLabel,
      unit: "",
      type: "count",
    }));

  return [
    ...valueOptions,
    ...countOptions,
  ];
};
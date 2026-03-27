# Biological Interpretation of Causal Bootstrapping Results

This document provides a biology-focused interpretation of the modelling results from the coronary artery disease (CAD) prediction experiments, especially the observation that **tree-based models improved in accuracy after causal bootstrapping**, while **gradient-descent-based models showed a slight decrease**.

---

## What the Results Suggest Overall

The central finding is that **accounting for age and sex as confounders changed the type of signal available to the models**.

Before deconfounding, part of the predictive performance likely came from broad observational patterns such as:

- older patients being more likely to have CAD
- male patients being more likely to have earlier obstructive CAD
- multiple clinical variables co-varying with age and sex

After causal bootstrapping, the models were forced to rely less on those broad demographic shortcuts and more on the remaining clinical structure in the data.

This suggests that some of the original predictive signal was due to **background susceptibility**, while the post-bootstrap signal may be more reflective of **proximal disease expression**.

In biological terms, the results are consistent with the idea that:

- **age and sex capture a large amount of baseline cardiovascular vulnerability**
- once this confounding structure is reduced, the remaining predictive variables may better reflect **active ischemic burden**, **functional limitation**, **haemodynamic stress**, and **disease manifestation**

---

## Why Age and Sex Matter Biologically

Age and sex are not simple nuisance variables in heart disease. They are deeply linked to CAD biology.

### Age

Age acts as a proxy for several cumulative biological processes:

- progressive atherosclerotic plaque development
- endothelial dysfunction
- vascular stiffening
- chronic inflammatory exposure
- long-term burden of hypertension, diabetes, and dyslipidaemia
- reduced cardiovascular reserve

As age increases, multiple clinical variables may shift together, not necessarily because they directly cause CAD in isolation, but because they all reflect the same long-term disease accumulation process.

### Sex

Sex is biologically important because it influences:

- hormonal protection and its loss over time
- plaque morphology and rupture patterns
- vascular tone and endothelial responses
- symptom presentation
- prevalence and timing of obstructive CAD
- microvascular versus macrovascular disease patterns

This means sex can shape both baseline risk and the way disease is clinically expressed.

---

## Interpretation of the Model Pattern

## 1. Why tree-based models may improve after causal bootstrapping

Tree-based models are well suited to heart disease because CAD biology is often **nonlinear** and **interaction-driven**.

These models can better capture patterns such as:

- chest pain becoming more informative when combined with exercise-induced angina
- ST depression becoming especially meaningful when paired with reduced exercise capacity
- blood pressure having different risk implications depending on age, sex, or other vascular indicators
- vessel-related findings carrying different meaning depending on symptom profile

If tree-based models improved after deconfounding, one plausible interpretation is that **removing age/sex confounding reduced noise and uncovered more disease-specific interaction structure**.

Biologically, that means the models may have become better at detecting combinations of features linked to the actual manifestation of coronary disease, rather than relying on broad demographic risk gradients.

### Biological implication

This supports the idea that the post-bootstrap signal contains more information about:

- myocardial ischemia
- exercise intolerance
- haemodynamic stress
- electrical changes associated with reduced coronary perfusion
- burden of vascular disease

rather than simply who belongs to an older or higher-risk sex-defined group.

---

## 2. Why gradient-descent-based models may decrease slightly

Gradient-descent-based models, especially simpler linear or shallow parametric models, often perform well when the data contain a strong smooth trend.

Age and sex create exactly this kind of structure:

- older age tends to increase global CAD risk
- male sex often increases baseline probability in observational CAD datasets
- several predictors may align along that same broad risk gradient

After deconfounding, those strong smooth trends are weakened.

What remains may be:

- less globally linear
- more heterogeneous across patients
- more dependent on local combinations of variables
- harder to capture with a simple gradient-based boundary

A slight drop in these models therefore suggests that some of their original performance may have depended on **confounded linear structure**, not purely on disease-specific patterns.

### Biological implication

This implies that once age and sex are controlled for, CAD risk in the remaining variables may no longer behave like a simple monotonic gradient. Instead, it may reflect more complex combinations of:

- ischemic symptoms
- exercise response
- ECG changes
- vessel burden
- metabolic and haemodynamic stress

---

## What This Says About the Relations Between Variables

The results suggest that **age and sex were influencing the apparent associations between several predictors and heart disease status**.

That means some variable-outcome relationships in the raw observational data may have looked stronger because both the predictor and the outcome were partly driven by the same confounders.

For example:

- older patients may have lower maximum heart rate, more abnormal exercise tests, and more CAD
- men may be overrepresented among patients with particular symptom profiles or angiographic burden
- blood pressure, exercise capacity, and ECG-related variables may partly reflect age-related cardiovascular decline

After deconfounding, variables that still remain useful are more likely to reflect processes closer to disease expression itself.

### This means the remaining predictive relations may be closer to:

- ischemia-related symptom expression
- reduced myocardial perfusion during stress
- functional limitation under exertion
- structural burden of coronary narrowing
- cardiovascular compensation failure

In short, the bootstrap results suggest that some observed associations were partly **demographic shortcuts**, while the remaining signal may be more **pathophysiologically meaningful**.

---

## Variable-Level Biological Reading

Depending on the exact features used from the UCI heart disease dataset, the following interpretations are biologically reasonable.

### Chest pain type

After deconfounding, chest pain may become more informative as a marker of actual ischemic symptom pattern rather than simply age-related symptom frequency.

### Exercise-induced angina

This variable is close to disease expression because it reflects insufficient myocardial oxygen supply during exertion. If it remains predictive after deconfounding, that supports a more direct link to ischemic physiology.

### ST depression / oldpeak

This is highly relevant biologically because it can reflect myocardial ischemia under stress. Stronger importance after deconfounding would suggest the model is relying more on cardiac functional abnormality than demographic structure.

### Maximum heart rate achieved

This may partly reflect age, but after controlling for age it can become a better marker of exercise intolerance or impaired cardiovascular reserve.

### Resting blood pressure

Its meaning may shift after deconfounding: instead of acting partly as an age proxy, it may better represent haemodynamic strain and vascular stress.

### Cholesterol

In observational data, cholesterol may partly track broader demographic or lifestyle patterns. After deconfounding, any retained predictive value may better reflect its role in atherosclerotic risk biology.

### Number of major vessels / thal / angiographic-related variables

These may be closer to structural disease burden. If tree-based models benefit from these after bootstrapping, it may indicate the model is detecting interactions between structural burden and functional symptoms.

---

## Main Biological Conclusion

A reasonable biological interpretation of the results is:

> Causal bootstrapping appears to reduce the extent to which the models rely on age- and sex-driven background susceptibility, and instead shifts the predictive task toward more disease-specific clinical patterns. The improvement in tree-based models suggests that the remaining CAD signal is nonlinear and interaction-based, consistent with the biology of coronary artery disease, where symptoms, exercise response, ECG abnormalities, and vascular burden interact in complex ways. The slight decrease in gradient-descent-based models suggests that some of their original performance may have depended on smoother demographic risk gradients rather than the more complex pathophysiological structure of the disease.

---

## Safe Interpretation Boundaries

These results **do not prove causality** for any individual variable.

The safer interpretation is that post-bootstrap predictive structure is:

- less dominated by demographic confounding
- more robust across resampled populations
- more consistent with disease-relevant biology
- potentially closer to proximal CAD manifestation

Avoid stronger claims such as:

- “this proves these variables cause heart disease”
- “the model discovered the true biology of CAD”

Prefer language such as:

- “consistent with”
- “suggests”
- “more proximal to disease expression”
- “less reliant on confounded demographic structure”
- “more biologically plausible disease-related signal”

---

## Suggested Dissertation/Report Extract

The observed divergence between model families after causal bootstrapping suggests that age and sex contributed substantial confounding structure to the observational CAD dataset. Once these confounders were accounted for, tree-based models showed improved accuracy, consistent with reduced demographic noise and improved detection of nonlinear, interaction-based patterns more closely related to coronary artery disease biology. In contrast, the slight reduction in performance among gradient-descent-based models suggests that some of their original predictive strength may have been derived from smoother age- and sex-related risk gradients. Biologically, this indicates that the residual predictive structure after deconfounding may be more reflective of disease manifestation itself, including ischemic symptoms, exercise intolerance, ECG abnormalities, and vascular burden, rather than broad background susceptibility alone.

---

## Possible Diagrams to Include

### 1. Confounded vs deconfounded signal diagram
A simple conceptual figure with two panels:

- **Before causal bootstrapping**  
  age and sex influence both predictors and CAD outcome
- **After causal bootstrapping**  
  the direct shortcut through age/sex is weakened, so the model relies more on clinical variables

Suggested boxes:
- Age
- Sex
- Chest pain
- Exercise angina
- ST depression
- Max heart rate
- CAD outcome

This can be drawn as a DAG-style figure.

---

### 2. Model family interpretation diagram
A two-column figure:

**Tree-based models**
- improved after deconfounding
- capture nonlinear interactions
- likely detecting disease-expression patterns

**Gradient-descent models**
- slightly reduced after deconfounding
- depend more on smooth global trends
- may lose performance when demographic shortcuts are removed

This helps explain the biological meaning of the divergence.

---

### 3. Biology pathway schematic
A figure showing:

- **Age / Sex** -> baseline susceptibility
- **Atherosclerosis / vascular ageing / hormonal effects** -> underlying disease vulnerability
- **Exercise angina / ST depression / chest pain / vessel burden** -> active disease manifestation
- **Model prediction**

The key message is that deconfounding shifts prediction from broad susceptibility to more proximal clinical manifestation.

---

### 4. Variable relation map
A network-style diagram showing possible relationships:

- age -> max heart rate, blood pressure, vessel disease
- sex -> symptom pattern, baseline CAD prevalence
- CAD biology -> chest pain, oldpeak, exercise angina, vessel burden
- outcome -> diagnosed heart disease

This can visually support your argument that multiple predictor-outcome associations may have been confounded.

---

### 5. Performance comparison bar chart
Include a bar chart of:
- pre-bootstrap accuracy
- post-bootstrap accuracy

Grouped by model family:
- random forest / XGBoost / decision tree
- logistic regression / neural net / other gradient-based methods

Add a caption explaining that improvement in tree models may indicate stronger performance on deconfounded, interaction-rich signal.

---

## One-Sentence Summary

The results suggest that after accounting for age and sex, the remaining signal for coronary artery disease may be less driven by broad demographic susceptibility and more driven by nonlinear combinations of clinically meaningful features that reflect the biological expression of heart disease itself.

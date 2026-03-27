# Research Notebooks

This folder contains the exploratory, causal-bootstrap, and model-comparison notebooks for the heart disease dataset. The most useful way to summarize the results is not just "which model scored highest," but what kind of cardiovascular biology the models seem to be recovering.

## Biological Conclusion

Taken together, the notebooks look most consistent with a **coronary ischemia phenotype** rather than a vague generic "heart risk" label. The strongest predictors cluster around:

- **atherosclerotic vessel burden** (`ca`)
- **stress-induced perfusion abnormality** (`thal_ReversibleDefect`)
- **exercise-triggered ischemic symptoms** (`exang_YesExAngina`)
- **stress ECG change / repolarization abnormality** (`oldpeak`, `slope_Flat`)
- **reduced exercise-linked cardiovascular reserve** (`thalach`)

Biologically, those variables sit relatively close to the pathway from **coronary plaque burden -> reduced coronary flow reserve -> myocardial oxygen supply-demand mismatch -> inducible ischemia during stress testing**.

That is important because it means the label is probably being driven less by isolated background risk factors and more by a downstream phenotype that resembles **clinically manifest ischemic heart disease**.

## What Deconfounding Seems To Mean Biologically

The backdoor notebook adjusts for age and sex as confounders. In the saved comparison outputs, performance on the **confounded test set** improves after training on the **deconfounded backdoor dataset** for several flexible models:

- `RandomForest`: accuracy rises from about **0.836** to **0.855**
- `XGBoost`: accuracy rises from about **0.818** to **0.945**
- `MLPClassifier`: accuracy rises from about **0.836** to **0.909**
- `LogisticRegression`: stays roughly flat at **0.836**

The biological interpretation is that deconfounding may be removing part of the broad demographic signal that is related to age/sex structure but is not the most proximal expression of ischemic disease biology. Once some of that nuisance structure is reduced, the better-performing nonlinear models can put more weight on the **joint physiologic pattern**:

- multivessel disease burden
- reversible perfusion abnormality
- exercise-induced angina
- ST-segment depression / flat recovery slope
- lower exercise tolerance

That pattern is biologically plausible. Ischemic heart disease is not usually expressed as one variable acting alone. It is a **thresholded, interacting syndrome** in which plaque burden, impaired perfusion reserve, symptom provocation on exertion, and abnormal stress ECG behavior reinforce each other.

So a reasonable conclusion from the notebooks is:

> After deconfounding, the tree-based models appear to pick up a cleaner ischemia-related signal, suggesting that the underlying biology in this dataset is interaction-heavy and closer to stress-provoked coronary dysfunction than to demographics alone.

## Why Tree-Based Models Might Benefit More

This is also biologically coherent.

Tree-based models are good at learning **nonlinear interactions and cutoff behavior**. That matters here because coronary disease biology often behaves in combined states rather than smooth linear increments. For example, a patient with:

- higher apparent vessel burden (`ca`)
- a reversible perfusion defect (`thal_ReversibleDefect`)
- exercise angina (`exang_YesExAngina`)
- and greater ST depression (`oldpeak`)

is not just "a little higher risk" on four separate axes. That combination is more consistent with a patient whose myocardium is already showing **stress-provoked ischemia**. A tree model can separate those joint states more naturally than a simple linear boundary.

The fact that logistic regression changes much less after deconfounding supports that interpretation: the residual signal is probably not purely additive and linear. It looks more like a **multifeature ischemic pattern**.

## Biological Meaning Of The Main Variables

- `ca`: This is most naturally interpreted as a marker of **greater coronary atherosclerotic burden / more extensive vessel involvement**. Classic angiographic studies showed that increasing extent of coronary disease is associated with worse long-term prognosis.
- `thal_ReversibleDefect`: A reversible defect on stress imaging is biologically aligned with **inducible myocardial ischemia**, where perfusion is relatively preserved at rest but becomes insufficient under stress.
- `exang_YesExAngina`: Exercise-induced angina fits the physiology of **myocardial oxygen demand exceeding coronary supply**, especially when epicardial stenosis or impaired flow reserve limits hyperemic perfusion.
- `oldpeak` and `slope_Flat`: These are compatible with **stress-related repolarization abnormality**, which is often used clinically as an indirect signal of ischemia.
- `cp_Asymptomatic`: In this dataset, asymptomatic chest-pain coding still associates strongly with disease, which is consistent with the clinical reality that **silent ischemia** and atypical symptom presentation can still reflect meaningful coronary pathology.
- `thalach`: Lower achieved peak heart rate likely reflects **reduced exercise capacity / limited cardiovascular reserve** in the diseased group rather than a protective effect of not exercising. In an ischemic phenotype, patients often terminate exercise earlier or fail to mount as robust a stress response.

## What This Implies About The Dataset

The notebooks suggest that this dataset is not only detecting upstream vascular risk factors such as blood pressure or cholesterol. It seems to be capturing something closer to a **stress-test-defined ischemic endophenotype**.

That is why the strongest variables are not only classic epidemiologic risk factors. They are variables closer to the moment where coronary disease becomes physiologically visible:

- abnormal perfusion
- exertional ischemic symptoms
- stress ECG abnormality
- reduced functional reserve

In that sense, the deconfounded results support the idea that the disease signal is **biologically structured** and not just a demographic shortcut.

## Limits Of That Interpretation

- The target is still a broad `heartdiseasepresence` label, so this is an interpretation of the learned signal, not proof that every positive case is the same pathology.
- The variables are mostly **clinical surrogates**, not molecular assays. The notebooks do not directly measure plaque inflammation, endothelial dysfunction, fibrosis, or myocardial remodeling biomarkers.
- Some ischemic patterns can occur without classic obstructive epicardial disease, so the cleanest statement is that the models recover a **coronary ischemia / stress-abnormality phenotype**, not a perfect one-to-one map to a single cellular mechanism.

## Literature Anchors

These papers are useful for grounding the biological interpretation:

- Mark DB et al. *Exercise treadmill score for predicting prognosis in coronary artery disease.* Ann Intern Med. 1987. Supports the idea that exercise-test variables integrate ischemic burden and prognosis. <https://pubmed.ncbi.nlm.nih.gov/3579066/>
- Gibbons RJ et al. *ACC/AHA 2002 guideline update for exercise testing: summary article.* Summarizes the physiologic meaning of exercise-induced angina and ST-segment depression in ischemia evaluation. <https://pubmed.ncbi.nlm.nih.gov/12392846/>
- Hachamovitch R et al. *Comparison of the short-term survival benefit associated with revascularization compared with medical therapy in patients with no prior coronary artery disease undergoing stress myocardial perfusion single photon emission computed tomography.* Circulation. 2003. Supports inducible perfusion defects as markers of clinically meaningful ischemic burden. <https://pubmed.ncbi.nlm.nih.gov/12771008/>
- Uren NG et al. *Correlation between exercise-induced ischemic ST-segment depression and myocardial blood flow quantified by positron emission tomography.* Gives mechanistic support for linking stress ECG abnormality to reduced myocardial perfusion during exercise. <https://pubmed.ncbi.nlm.nih.gov/9736149/>
- Lauer MS et al. *Chronotropic response to exercise predicts angiographic severity in patients with suspected or stable coronary artery disease.* Supports interpreting lower achieved heart-rate response as part of a more severe coronary phenotype. <https://pubmed.ncbi.nlm.nih.gov/7503001/>
- Mock MB et al. *Factors associated with survival in patients with severe coronary artery disease in the Coronary Artery Surgery Study (CASS).* Shows that greater angiographic disease extent is associated with worse prognosis. <https://pubmed.ncbi.nlm.nih.gov/6863543/>
- Conti CR et al. *Silent ischemia: clinical relevance.* Clarifies that asymptomatic ischemia can still represent important coronary pathology. <https://pubmed.ncbi.nlm.nih.gov/22281245/>

## Notebook Guide

- `initial EDA.ipynb`: descriptive analysis of the encoded heart disease variables
- `backdoor_causal_bootstrap_algorithm.ipynb`: generates the backdoor-adjusted dataset
- `confounded_vs_deconfounded_accuracy.ipynb`: compares model behavior before and after deconfounding
- `LogisticRegression.ipynb`, `SupportVectorMachine.ipynb`, `RandomForest.ipynb`, `NeuralNetwork.ipynb`, `XGBoost.ipynb`: model training and evaluation notebooks

If you keep extending this project, the most defensible high-level framing is:

> The models appear to learn a deconfounded, interaction-heavy phenotype of coronary ischemia, where vessel burden, inducible perfusion abnormality, exertional symptoms, stress ECG change, and reduced exercise reserve combine into the observed heart-disease signal.

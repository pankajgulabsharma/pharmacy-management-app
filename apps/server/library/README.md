# Medicine Library data

`medicines.tsv.br` — about 2.4 lakh Indian medicines (name, company, pack,
salt / composition, printed price) used to fill the "Add medicine" form.

**Source:** A-Z Medicine Dataset of India, published on Kaggle
(data as of November 2022), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

**Changes made:** discontinued products and repeated name + pack rows were
removed; only the columns above are kept; spacing tidied; sorted by name.
This adapted data file is shared under the same licence, CC BY-SA 4.0.

Prices are as printed in 2022 and are only a reference — the shop always
checks MRP, HSN, GST and schedule against the pack.

Rebuild from a newer copy of the CSV:

```sh
npm run library:build -w @medicare/server -- path/to/A_Z_medicines_dataset_of_India.csv
```

The server turns this file into its own search index
(`medicine-library.sqlite`, next to the shop database) on first start, and
again automatically whenever this file changes.

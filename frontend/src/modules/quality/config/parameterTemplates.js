// Quality parameter templates for Enterprise QC workflow
// Contains physical, chemical, and microbiology parameters for master products

const parameterTemplates = {
  Rice: {
    Physical: [
      { id: 'rice_moisture', parameter: 'Moisture', min: 9.0, max: 14.0, specification: '9.0% - 14.0%', unit: '%', method: 'IS: 4333 (Part II)' },
      { id: 'rice_foreign_matter', parameter: 'Foreign Matter', max: 1.0, specification: 'Max 1.0%', unit: '%', method: 'IS: 4333 (Part I)' },
      { id: 'rice_damaged_grains', parameter: 'Damaged Grains', max: 2.0, specification: 'Max 2.0%', unit: '%', method: 'Visual inspection' },
      { id: 'rice_broken_grains', parameter: 'Broken Grains', max: 5.0, specification: 'Max 5.0%', unit: '%', method: 'IS: 4333 (Part I)' },
      { id: 'rice_weeviled_grains', parameter: 'Weeviled Grains', max: 0.5, specification: 'Max 0.5%', unit: '%', method: 'Visual count' }
    ],
    Chemical: [
      { id: 'rice_protein', parameter: 'Protein (Dry Basis)', min: 6.0, specification: 'Min 6.0%', unit: '%', method: 'AOAC 992.23' },
      { id: 'rice_ash', parameter: 'Acid Insoluble Ash', max: 0.5, specification: 'Max 0.5%', unit: '%', method: 'IS: 1155' }
    ],
    Microbiology: [
      { id: 'rice_yeast_mold', parameter: 'Yeast & Mold Count', max: 100, specification: 'Max 100 CFU/g', unit: 'CFU/g', method: 'ISO 21527' },
      { id: 'rice_ecoli', parameter: 'E. Coli', specification: 'Absent', unit: '/g', method: 'ISO 16649' },
      { id: 'rice_salmonella', parameter: 'Salmonella', specification: 'Absent', unit: '/25g', method: 'ISO 6579' }
    ]
  },
  Wheat: {
    Physical: [
      { id: 'wheat_moisture', parameter: 'Moisture', min: 9.0, max: 12.5, specification: '9.0% - 12.5%', unit: '%', method: 'IS: 4333 (Part II)' },
      { id: 'wheat_foreign_matter', parameter: 'Foreign Matter', max: 1.5, specification: 'Max 1.5%', unit: '%', method: 'IS: 4333 (Part I)' },
      { id: 'wheat_damaged_grains', parameter: 'Damaged Grains', max: 1.5, specification: 'Max 1.5%', unit: '%', method: 'Visual inspection' },
      { id: 'wheat_weeviled_grains', parameter: 'Weeviled Grains', max: 1.0, specification: 'Max 1.0%', unit: '%', method: 'Visual count' }
    ],
    Chemical: [
      { id: 'wheat_gluten', parameter: 'Wet Gluten', min: 9.0, specification: 'Min 9.0%', unit: '%', method: 'IS: 1155' },
      { id: 'wheat_protein', parameter: 'Protein (Dry Basis)', min: 11.5, specification: 'Min 11.5%', unit: '%', method: 'AOAC 992.23' },
      { id: 'wheat_ash', parameter: 'Acid Insoluble Ash', max: 1.0, specification: 'Max 1.0%', unit: '%', method: 'IS: 1155' }
    ],
    Microbiology: [
      { id: 'wheat_yeast_mold', parameter: 'Yeast & Mold Count', max: 150, specification: 'Max 150 CFU/g', unit: 'CFU/g', method: 'ISO 21527' },
      { id: 'wheat_ecoli', parameter: 'E. Coli', specification: 'Absent', unit: '/g', method: 'ISO 16649' },
      { id: 'wheat_salmonella', parameter: 'Salmonella', specification: 'Absent', unit: '/25g', method: 'ISO 6579' }
    ]
  },
  BengalGram: {
    Physical: [
      { id: 'bg_moisture', parameter: 'Moisture', min: 9.0, max: 12.0, specification: '9.0% - 12.0%', unit: '%', method: 'IS: 4333 (Part II)' },
      { id: 'bg_foreign_matter', parameter: 'Foreign Matter', max: 1.0, specification: 'Max 1.0%', unit: '%', method: 'IS: 4333 (Part I)' },
      { id: 'bg_damaged_grains', parameter: 'Damaged Grains', max: 2.0, specification: 'Max 2.0%', unit: '%', method: 'Visual inspection' },
      { id: 'bg_weeviled_grains', parameter: 'Weeviled Grains', max: 0.5, specification: 'Max 0.5%', unit: '%', method: 'Visual count' }
    ],
    Chemical: [
      { id: 'bg_protein', parameter: 'Protein (Dry Basis)', min: 20.0, specification: 'Min 20.0%', unit: '%', method: 'AOAC 992.23' },
      { id: 'bg_ash', parameter: 'Acid Insoluble Ash', max: 3.0, specification: 'Max 3.0%', unit: '%', method: 'IS: 1155' }
    ],
    Microbiology: [
      { id: 'bg_yeast_mold', parameter: 'Yeast & Mold Count', max: 100, specification: 'Max 100 CFU/g', unit: 'CFU/g', method: 'ISO 21527' },
      { id: 'bg_ecoli', parameter: 'E. Coli', specification: 'Absent', unit: '/g', method: 'ISO 16649' },
      { id: 'bg_salmonella', parameter: 'Salmonella', specification: 'Absent', unit: '/25g', method: 'ISO 6579' }
    ]
  },
  Urad: {
    Physical: [
      { id: 'urad_moisture', parameter: 'Moisture', min: 9.0, max: 12.0, specification: '9.0% - 12.0%', unit: '%', method: 'IS: 4333 (Part II)' },
      { id: 'urad_foreign_matter', parameter: 'Foreign Matter', max: 1.0, specification: 'Max 1.0%', unit: '%', method: 'IS: 4333 (Part I)' },
      { id: 'urad_damaged_grains', parameter: 'Damaged Grains', max: 2.0, specification: 'Max 2.0%', unit: '%', method: 'Visual inspection' },
      { id: 'urad_weeviled_grains', parameter: 'Weeviled Grains', max: 0.5, specification: 'Max 0.5%', unit: '%', method: 'Visual count' }
    ],
    Chemical: [
      { id: 'urad_protein', parameter: 'Protein (Dry Basis)', min: 22.0, specification: 'Min 22.0%', unit: '%', method: 'AOAC 992.23' },
      { id: 'urad_ash', parameter: 'Acid Insoluble Ash', max: 3.2, specification: 'Max 3.2%', unit: '%', method: 'IS: 1155' }
    ],
    Microbiology: [
      { id: 'urad_yeast_mold', parameter: 'Yeast & Mold Count', max: 100, specification: 'Max 100 CFU/g', unit: 'CFU/g', method: 'ISO 21527' },
      { id: 'urad_ecoli', parameter: 'E. Coli', specification: 'Absent', unit: '/g', method: 'ISO 16649' },
      { id: 'urad_salmonella', parameter: 'Salmonella', specification: 'Absent', unit: '/25g', method: 'ISO 6579' }
    ]
  }
};

export default parameterTemplates;

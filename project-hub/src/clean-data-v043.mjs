/* A clean new staff workspace. Contract-derived records are imported privately by the owner.
   Never commit customer contracts, pricing, or project-specific state to the public repository. */
export function emptyWorkspace(){
 return {
  version:1, organizations:[],projects:[],sections:[],tasks:[],parts:[],bom:[],orders:[],
  movements:[],updates:[],approvals:[],documents:[],members:[],messages:[],
  notifications:[],audit:[],settings:{theme:'light'},
  assemblies:[],assemblyBOM:[],drawingRevisions:[],engineeringChanges:[],jobAssemblyLinks:[],
  manufacturingMigrationVersion:1,materialsSchemaVersion:1,stockReservations:[],
  procurementReceipts:[],procurementReturns:[],projectProgressSteps:[],progressSchemaVersion:1,
  externalWorkRoutes:[],externalWorkEvents:[]
 };
}

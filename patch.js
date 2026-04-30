const fs = require('fs');

const file = 'configuration.tsx';
let data = fs.readFileSync(file, 'utf8');

const TABS_START_REGEX = /<TabsList className="bg-gray-100\/80[\s\S]*?<\/TabsList>/;
const NEW_TABS_LIST = `                          <TabsList className="bg-transparent space-x-2 mb-6 p-0 h-auto">
                            <TabsTrigger 
                                value="subscription" 
                                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Subscriptions
                              <span className={\`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold \${customFieldKind === 'subscription' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}\`}>
                                {fields.length}
                              </span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="compliance" 
                                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Compliance
                              <span className={\`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold \${customFieldKind === 'compliance' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}\`}>
                                {complianceFields.length}
                              </span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="renewal" 
                                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-[#6366f1] data-[state=active]:text-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-100"
                            >
                              Renewals
                              <span className={\`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold \${customFieldKind === 'renewal' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}\`}>
                                {renewalFields.length}
                              </span>
                            </TabsTrigger>
                          </TabsList>`;

data = data.replace(TABS_START_REGEX, NEW_TABS_LIST);

// Update ALL TableHeaders
const HEADER_REGEX = /<TableHeader>[\s\S]*?<\/TableHeader>/g;
const NEW_HEADER = `<TableHeader>
                                    <TableRow className="bg-[#4f46e5] hover:bg-[#4f46e5] border-none">
                                      <TableHead className="text-white font-bold h-12 px-6 uppercase text-xs">Field Name</TableHead>
                                      <TableHead className="text-white font-bold h-12 uppercase text-xs">Field Type</TableHead>
                                      <TableHead className="text-white font-bold h-12 uppercase text-xs">Required</TableHead>
                                      <TableHead className="text-white font-bold h-12 uppercase text-xs">Status</TableHead>
                                      <TableHead className="text-white font-bold h-12 text-right px-6 uppercase text-xs">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>`;
data = data.replace(HEADER_REGEX, NEW_HEADER);

// Update Subscription row 
const SUB_ROW_REGEX = /<TableRow key={field.name}[\s\S]*?<\/TableRow>/;
const NEW_SUB_ROW = `<TableRow key={field.name} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                          <TableCell className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-4">
                                            <GripVertical className="h-4 w-4 text-gray-300 cursor-move" />
                                            {field.name}
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex flex-shrink-0 items-center justify-center rounded-full px-3 py-0.5 text-xs font-bold \${
                                              (field.type || 'Text') === 'Text' ? 'bg-indigo-100 text-indigo-700' :
                                              (field.type || 'Text') === 'Date' ? 'bg-teal-100 text-teal-700' :
                                              'bg-blue-100 text-blue-700'
                                            }\`}>
                                              {field.type || 'Text'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <Switch
                                              checked={!!field.required}
                                              className="data-[state=checked]:bg-[#6366f1]"
                                              onCheckedChange={() => {}} 
                                            />
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold \${
                                              field.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                            }\`}>
                                              <span className={\`w-1.5 h-1.5 rounded-full \${field.enabled ? 'bg-emerald-500' : 'bg-gray-400'}\`}></span>
                                              {field.enabled ? 'Active' : 'Inactive'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right px-6 py-4">
                                            <div className="flex justify-end gap-3">
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-md shadow-sm"
                                                onClick={() => {
                                                    setIsCreateFieldModalOpen(true);
                                                }}
                                                title="Edit"
                                                >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                                </Button>
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 border-red-100 hover:bg-red-50 rounded-md shadow-sm"
                                                onClick={() => requestDeleteCustomField({ kind: 'subscription', name: field.name })}
                                                title="Delete"
                                                >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                                </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>`;
data = data.replace(SUB_ROW_REGEX, NEW_SUB_ROW);

// Update Compliance row 
const COMP_ROW_REGEX = /<TableRow key={field._id \|\| field.name}[\s\S]*?<\/TableRow>/;
const NEW_COMP_ROW = `<TableRow key={field._id || field.name} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                          <TableCell className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-4">
                                            <GripVertical className="h-4 w-4 text-gray-300 cursor-move" />
                                            {field.name}
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex flex-shrink-0 items-center justify-center rounded-full px-3 py-0.5 text-xs font-bold \${
                                              (field.type || 'Text') === 'Text' ? 'bg-indigo-100 text-indigo-700' :
                                              (field.type || 'Text') === 'Date' ? 'bg-teal-100 text-teal-700' :
                                              'bg-blue-100 text-blue-700'
                                            }\`}>
                                              {field.type || 'Text'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <Switch
                                              checked={!!field.required}
                                              className="data-[state=checked]:bg-[#6366f1]"
                                              onCheckedChange={() => {}} 
                                            />
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold \${
                                              field.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                            }\`}>
                                              <span className={\`w-1.5 h-1.5 rounded-full \${field.enabled ? 'bg-emerald-500' : 'bg-gray-400'}\`}></span>
                                              {field.enabled ? 'Active' : 'Inactive'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right px-6 py-4">
                                            <div className="flex justify-end gap-3">
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-md shadow-sm"
                                                disabled={!field._id}
                                                onClick={() => {
                                                    setIsCreateFieldModalOpen(true);
                                                }}
                                                title="Edit"
                                                >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                                </Button>
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 border-red-100 hover:bg-red-50 rounded-md shadow-sm"
                                                disabled={!field._id}
                                                onClick={() => {
                                                  if (!field._id) {
                                                    showCustomFieldError('Cannot delete this field right now. Please refresh the page and try again.');
                                                    return;
                                                  }
                                                  requestDeleteCustomField({ kind: 'compliance', id: field._id, name: field.name });
                                                }}
                                                title="Delete"
                                                >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                                </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>`;
data = data.replace(COMP_ROW_REGEX, NEW_COMP_ROW);

// Update Renewal row 
const REN_ROW_REGEX = /<TableRow key={field._id \|\| field.name}[\s\S]*?<\/TableRow>/;
const NEW_REN_ROW = `<TableRow key={field._id || field.name} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                          <TableCell className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-4">
                                            <GripVertical className="h-4 w-4 text-gray-300 cursor-move" />
                                            {field.name}
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex flex-shrink-0 items-center justify-center rounded-full px-3 py-0.5 text-xs font-bold \${
                                              (field.type || 'Text') === 'Text' ? 'bg-indigo-100 text-indigo-700' :
                                              (field.type || 'Text') === 'Date' ? 'bg-teal-100 text-teal-700' :
                                              'bg-blue-100 text-blue-700'
                                            }\`}>
                                              {field.type || 'Text'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <Switch
                                              checked={!!field.required}
                                              className="data-[state=checked]:bg-[#6366f1]"
                                              onCheckedChange={() => {}} 
                                            />
                                          </TableCell>
                                          <TableCell className="py-4">
                                            <span className={\`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold \${
                                              field.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                            }\`}>
                                              <span className={\`w-1.5 h-1.5 rounded-full \${field.enabled ? 'bg-emerald-500' : 'bg-gray-400'}\`}></span>
                                              {field.enabled ? 'Active' : 'Inactive'}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right px-6 py-4">
                                            <div className="flex justify-end gap-3">
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-md shadow-sm"
                                                disabled={!field._id}
                                                onClick={() => {
                                                    setIsCreateFieldModalOpen(true);
                                                }}
                                                title="Edit"
                                                >
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit</span>
                                                </Button>
                                                <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 border-red-100 hover:bg-red-50 rounded-md shadow-sm"
                                                disabled={!field._id}
                                                onClick={() => {
                                                  if (!field._id) {
                                                    showCustomFieldError('Cannot delete this field right now. Please refresh the page and try again.');
                                                    return;
                                                  }
                                                  requestDeleteCustomField({ kind: 'renewal', id: field._id, name: field.name });
                                                }}
                                                title="Delete"
                                                >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete</span>
                                                </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>`;
data = data.replace(REN_ROW_REGEX, NEW_REN_ROW);


fs.writeFileSync(file, data);
console.log('Patched');

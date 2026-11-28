/** Shared Tailwind recipes for application surfaces and their Storybook examples.
 * Named groups are context/state hooks, not custom CSS definitions.
 * The doubled selector preserves application overrides of shadcn defaults.
 */
export const appStyles = {
  dialogTitle: '[&&]:text-[length:25px]',
  appShell: [
    '[&&]:min-h-[100vh] [&&]:bg-[#f4f8fa]',
    'max-650:[&&]:pb-[calc(80px_+_env(safe-area-inset-bottom))]',
  ].join(' '),
  appStartup: [
    '[&&]:min-h-[100svh] [&&]:[padding:32px_24px] [&&]:flex [&&]:flex-col [&&]:items-center [&&]:justify-center [&&]:gap-[16px] [&&]:text-center',
    '[&&_button]:[border:0] [&&_button]:rounded-[10px] [&&_button]:[padding:12px_20px] [&&_button]:bg-[#087b87] [&&_button]:text-[#fff] [&&_button]:[font:inherit] [&&_button]:cursor-pointer',
  ].join(' '),
  topbar: [
    '[&&]:h-[auto] [&&]:bg-[#fff] [&&]:flex [&&]:items-center [&&]:justify-between [&&]:[padding:0_max(24px,_calc((100vw_-_1140px)_/_2))] [&&]:[border-bottom:1px_solid_#dce8e9] [&&]:min-h-[76px] [&&]:gap-[16px] [&&]:pt-[12px] [&&]:pb-[12px]',
    'max-650:[&&]:h-[auto] max-650:[&&]:[padding:0_20px] max-650:[&&]:flex-wrap max-650:[&&]:gap-[12px] max-650:[&&]:min-h-[76px] max-650:[&&]:pt-[12px] max-650:[&&]:pb-[12px]',
  ].join(' '),
  brand: [
    'group/brand',
    '[&&]:flex [&&]:items-center [&&]:gap-[8px] [&&]:font-extrabold [&&]:text-[length:19px] [&&]:tracking-[normal] [&&]:shrink-0 [&&]:text-[#083653]',
  ].join(' '),
  container: [
    'group/container',
    '[&&]:max-w-[1140px] [&&]:[margin:auto] [&&]:[padding:54px_24px_100px]',
    'max-650:[&&]:[padding:34px_18px_80px]',
  ].join(' '),
  sectionHeading: [
    '[&&]:flex [&&]:justify-between [&&]:[align-items:end] [&&]:gap-[20px]',
  ].join(' '),
  eyebrow: [
    '[&&]:[margin:0_0_10px] [&&]:text-[#08818e] [&&]:text-[length:12px] [&&]:font-extrabold [&&]:tracking-[0.17em]',
  ].join(' '),
  addButton: [
    'group/add-button',
    '[&&]:bg-[#087b87] [&&]:text-[#fff] [&&]:rounded-[10px] [&&]:h-[46px] [&&]:[padding:0_20px] [&&]:font-bold [&&]:inline-flex [&&]:gap-[9px]',
    '[&&:hover]:bg-[#075e69]',
  ].join(' '),
  saveButton: [
    '[&&]:bg-[#087b87] [&&]:text-[#fff] [&&]:rounded-[10px] [&&]:h-[46px] [&&]:[padding:0_20px] [&&]:font-bold [&&]:inline-flex [&&]:gap-[9px] [&&]:justify-self-end',
    '[&&:hover]:bg-[#075e69]',
  ].join(' '),
  stats: [
    'group/stats',
    '[&&]:grid [&&]:grid-cols-[repeat(3,_1fr)] [&&]:gap-[16px] [&&]:[margin:38px_0_55px]',
    '[&&_>_div]:bg-[#fff] [&&_>_div]:[border:1px_solid_#deeaeb] [&&_>_div]:rounded-[17px] [&&_>_div]:[padding:23px_27px] [&&_>_div]:shadow-[0_7px_22px_#154e5908]',
    '[&&_p]:[margin:17px_0_5px] [&&_p]:text-[#607980] [&&_p]:text-[length:14px] [&&_p]:font-bold',
    '[&&_strong]:text-[length:32px] [&&_strong]:leading-[1.2]',
    '[&&_small]:text-[length:14px] [&&_small]:ml-[5px] [&&_small]:font-medium',
    'max-650:[&&]:gap-[8px] max-650:[&&]:[margin:28px_0_42px]',
    'max-650:[&&_>_div]:[padding:14px_12px]',
    'max-650:[&&_p]:text-[length:12px] max-650:[&&_p]:[margin:13px_0_6px]',
    'max-650:[&&_strong]:text-[length:25px]',
    'max-650:[&&_small]:text-[length:12px]',
  ].join(' '),
  statIcon: [
    '[&&]:w-[39px] [&&]:h-[39px] [&&]:grid [&&]:place-items-center [&&]:bg-[#e1f1f2] [&&]:text-[#087b87] [&&]:rounded-[11px]',
    'max-650:[&&]:w-[32px] max-650:[&&]:h-[32px]',
  ].join(' '),
  resultCount: ['[&&]:text-[#607980] [&&]:text-[length:14px]'].join(' '),
  filters: [
    '[&&]:flex [&&]:gap-[12px] [&&]:[margin:24px_0_19px]',
    '[&&_select]:[border:1px_solid_#d7e5e6] [&&_select]:bg-[#fff] [&&_select]:rounded-[11px] [&&_select]:[padding:0_16px] [&&_select]:text-[#163b48] [&&_select]:min-w-[130px] [&&_select]:text-[length:14px]',
    'max-650:[&&]:flex-col',
    'max-650:[&&_select]:w-[100%] max-650:[&&_select]:h-[46px]',
  ].join(' '),
  search: [
    '[&&]:flex [&&]:items-center [&&]:gap-[9px] [&&]:bg-[#fff] [&&]:[border:1px_solid_#d7e5e6] [&&]:rounded-[11px] [&&]:[padding:0_14px] [&&]:w-[min(100%,_420px)] [&&]:h-[46px] [&&]:text-[#729098]',
    '[&&_input]:[outline:0] [&&_input]:[border:0] [&&_input]:w-[100%] [&&_input]:bg-transparent [&&_input]:text-[#163b48] [&&_input]:text-[length:15px]',
    'max-650:[&&]:w-[100%] max-650:[&&]:h-[46px]',
  ].join(' '),
  cards: ['[&&]:grid [&&]:gap-[12px]'].join(' '),
  catchCard: [
    '[&&]:flex [&&]:justify-between [&&]:[align-items:start] [&&]:gap-[12px] [&&]:bg-[#fff] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[15px] [&&]:[padding:22px_24px] [&&]:shadow-[0_5px_18px_#154e5906]',
    'max-650:[&&]:[padding:17px_14px] max-650:[&&]:flex-col max-650:[&&]:items-stretch',
    "max-650:[&&_>_[class~='group/card-main']]:w-[100%]",
    "max-650:[&&_>_[class~='group/card-actions']]:flex-row max-650:[&&_>_[class~='group/card-actions']]:items-center max-650:[&&_>_[class~='group/card-actions']]:justify-end max-650:[&&_>_[class~='group/card-actions']]:[border-top:1px_solid_#e7eff0] max-650:[&&_>_[class~='group/card-actions']]:pt-[8px]",
    "max-650:[&&_>_[class~='group/card-actions']_button]:min-w-[44px] max-650:[&&_>_[class~='group/card-actions']_button]:min-h-[44px]",
    "max-650:[&&_>_[class~='group/card-actions']_[class~='group/like-button']]:mr-[auto]",
    "max-650:[&&_[class~='group/card-photos']]:max-w-[100%]",
  ].join(' '),
  cardMain: [
    'group/card-main',
    '[&&]:flex [&&]:gap-[22px] [&&]:min-w-[0]',
    'max-650:[&&]:gap-[12px] max-650:[&&]:[flex:1]',
  ].join(' '),
  dateBadge: [
    '[&&]:min-w-[72px] [&&]:h-[86px] [&&]:rounded-[11px] [&&]:bg-[#e7f4f4] [&&]:flex [&&]:flex-col [&&]:justify-center [&&]:items-center [&&]:text-[#087b87] [&&]:shrink-0 [&&]:[padding:6px] [&&]:self-start',
    '[&&_strong]:text-[length:29px] [&&_strong]:leading-[1]',
    '[&&_span]:text-[length:12px] [&&_span]:mt-[3px] [&&_span]:whitespace-nowrap [&&_span]:leading-[1.2]',
    'max-650:[&&]:min-w-[56px] max-650:[&&]:h-[76px]',
    'max-650:[&&_strong]:text-[length:24px]',
  ].join(' '),
  catchInfo: [
    '[&&]:min-w-[0] [&&]:[overflow-wrap:anywhere]',
    'max-650:[&&]:[flex:1]',
  ].join(' '),
  catchTitle: [
    'group/catch-title',
    '[&&]:flex [&&]:items-center [&&]:gap-[12px] [&&]:flex-wrap',
    '[&&_h3]:text-[length:20px] [&&_h3]:[margin:2px_0_8px] [&&_h3]:[overflow-wrap:anywhere] [&&_h3]:min-w-[0] [&&_h3]:max-w-[100%]',
    'max-650:[&&_h3]:text-[length:18px]',
    'max-650:[&&]:flex-wrap max-650:[&&]:gap-[6px]',
  ].join(' '),
  countBadge: [
    'group/count-badge',
    '[&&]:bg-[#def0ed] [&&]:text-[#10766d] [&&]:font-bold [&&]:text-[length:13px] [&&]:rounded-[99px] [&&]:[padding:4px_9px]',
  ].join(' '),
  place: [
    'group/place',
    '[&&]:flex [&&]:items-center [&&]:gap-[5px] [&&]:text-[#526f78] [&&]:[margin:0] [&&]:text-[length:14px]',
  ].join(' '),
  details: [
    '[&&]:text-[#66818a] [&&]:[margin:8px_0_0] [&&]:text-[length:14px]',
  ].join(' '),
  memo: [
    '[&&]:text-[#45626b] [&&]:[margin:12px_0_0] [&&]:whitespace-pre-wrap [&&]:leading-[1.6]',
  ].join(' '),
  cardActions: [
    'group/card-actions',
    '[&&]:flex [&&]:gap-[4px] [&&]:flex-wrap [&&]:justify-end [&&]:shrink-0',
    '[&&_button]:[border:0] [&&_button]:bg-transparent [&&_button]:text-[#718d94] [&&_button]:[padding:9px] [&&_button]:rounded-[8px] [&&_button]:cursor-pointer',
    '[&&_button:hover]:bg-[#e8f3f3] [&&_button:hover]:text-[#087b87]',
    'max-650:[&&]:flex-col max-650:[&&]:items-center',
    "[&&_[class~='group/like-button']]:inline-flex [&&_[class~='group/like-button']]:items-center [&&_[class~='group/like-button']]:gap-[5px] [&&_[class~='group/like-button']]:min-w-[54px] [&&_[class~='group/like-button']]:min-h-[40px]",
    "[&&_[class~='group/is-liked']]:text-[#b93f60] [&&_[class~='group/is-liked']]:bg-[#fff0f4]",
    '[&&_button:disabled]:opacity-[0.55] [&&_button:disabled]:cursor-wait',
    '[&&_button:focus-visible]:[outline:2px_solid_#087b87] [&&_button:focus-visible]:outline-offset-[3px]',
    "[&&_[class~='group/like-button']:disabled]:opacity-[1] [&&_[class~='group/like-button']:disabled]:cursor-progress",
  ].join(' '),
  empty: [
    '[&&]:min-h-[230px] [&&]:[border:1px_dashed_#bbd3d7] [&&]:rounded-[15px] [&&]:flex [&&]:flex-col [&&]:items-center [&&]:justify-center [&&]:text-center [&&]:[padding:24px] [&&]:text-[#607980] [&&]:bg-[#ffffffa6]',
    '[&&_h3]:text-[length:20px] [&&_h3]:text-[#163b48] [&&_h3]:[margin:12px_0_4px]',
    '[&&_p]:[margin:4px_0_18px]',
  ].join(' '),
  emptyIcon: ['[&&]:text-[#087b87]'].join(' '),
  formDialog: [
    '[&&]:max-h-[90vh] [&&]:overflow-y-auto',
    'max-650:[&&]:[padding:20px_16px]',
  ].join(' '),
  entryForm: [
    '[&&]:grid [&&]:gap-[18px] [&&]:min-w-[0]',
    '[&&_>_*]:min-w-[0]',
    '[&&_label]:min-w-[0] [&&_label]:[overflow-wrap:anywhere] [&&_label]:grid [&&_label]:gap-[7px] [&&_label]:text-[length:14px] [&&_label]:font-bold [&&_label]:text-[#365a64]',
    '[&&_input]:h-[42px]',
    '[&&_textarea]:[resize:vertical] [&&_textarea]:min-h-[82px] [&&_textarea]:[border:1px_solid_#d3e1e2] [&&_textarea]:rounded-[8px] [&&_textarea]:[padding:11px] [&&_textarea]:[font:inherit]',
    "[&&_[role='alert']]:text-[#b63e42]",
    "[&&_[aria-invalid='true']]:[border-color:#b42318]",
    "[&&_>_[class~='group/catch-section']]:[min-inline-size:0] [&&_>_[class~='group/catch-section']]:[margin:0] [&&_>_[class~='group/catch-section']]:[padding:16px] [&&_>_[class~='group/catch-section']]:[border:1px_solid_#d7e5e6] [&&_>_[class~='group/catch-section']]:rounded-[12px] [&&_>_[class~='group/catch-section']]:grid [&&_>_[class~='group/catch-section']]:gap-[14px]",
    "[&&_>_[class~='group/catch-section']_>_legend]:[padding:0_7px] [&&_>_[class~='group/catch-section']_>_legend]:text-[#365a64] [&&_>_[class~='group/catch-section']_>_legend]:text-[length:16px] [&&_>_[class~='group/catch-section']_>_legend]:font-bold",
    "max-600:[&&_>_[class~='group/catch-section']]:[padding:12px]",
    "[&&_>_[class~='group/combination-editor']_>_[class~='group/combination-card']]:[margin-block:0]",
    "[&&_>_[class~='group/combination-editor']_>_[class~='group/gear-help']]:[margin-block:0]",
    "[&&_>_[class~='group/combination-editor']_>_[class~='group/gear-actions']]:[margin-block:0]",
    "[&&_>_[class~='group/combination-editor']_>_[class~='group/gear-actions']_>_button]:[flex:1_1_180px] [&&_>_[class~='group/combination-editor']_>_[class~='group/gear-actions']_>_button]:min-h-[44px] [&&_>_[class~='group/combination-editor']_>_[class~='group/gear-actions']_>_button]:whitespace-normal",
  ].join(' '),
  photoLabel: [
    '[&&]:[overflow-wrap:anywhere] [&&]:text-[length:14px] [&&]:font-bold [&&]:text-[#365a64]',
  ].join(' '),
  photoHelp: [
    '[&&]:[overflow-wrap:anywhere] [&&]:[margin:4px_0_12px] [&&]:text-[#607980] [&&]:text-[length:13px] [&&]:leading-[1.6]',
  ].join(' '),
  formGrid: [
    '[&&]:grid [&&]:grid-cols-[repeat(2,_minmax(0,_1fr))] [&&]:gap-[16px]',
    'max-650:[&&]:grid-cols-[1fr]',
  ].join(' '),
  photoField: ['[&&]:grid [&&]:gap-[10px]'].join(' '),
  photoPicker: [
    '[&&]:flex! [&&]:items-center [&&]:justify-center [&&]:gap-[9px] [&&]:[border:1px_dashed_#96bdc3] [&&]:rounded-[11px] [&&]:[padding:16px] [&&]:text-[#087b87]! [&&]:bg-[#eef8f8] [&&]:cursor-pointer [&&]:min-h-[60px]',
    '[&&:hover]:bg-[#dff2f2]',
    '[&&_input]:absolute [&&_input]:w-[1px] [&&_input]:h-[1px] [&&_input]:opacity-[0] [&&_input]:overflow-hidden',
    '[&&:focus-within]:[outline:2px_solid_#087b87] [&&:focus-within]:outline-offset-[2px]',
  ].join(' '),
  photoGrid: [
    '[&&]:flex [&&]:flex-wrap [&&]:gap-[8px]',
    "[&&_[class~='group/photo-thumbnail']]:relative [&&_[class~='group/photo-thumbnail']]:block [&&_[class~='group/photo-thumbnail']]:w-[92px] [&&_[class~='group/photo-thumbnail']]:h-[92px] [&&_[class~='group/photo-thumbnail']]:rounded-[9px] [&&_[class~='group/photo-thumbnail']]:overflow-hidden [&&_[class~='group/photo-thumbnail']]:[border:1px_solid_#d7e5e6] [&&_[class~='group/photo-thumbnail']]:bg-[#e8f3f3]",
    '[&&_img]:w-[100%] [&&_img]:h-[100%] [&&_img]:object-cover',
  ].join(' '),
  cardPhotos: [
    'group/card-photos',
    '[&&]:mt-[14px]',
    "[&&_[class~='group/photo-thumbnail']]:w-[111px] [&&_[class~='group/photo-thumbnail']]:h-[80px] [&&_[class~='group/photo-thumbnail']]:relative",
    "[&&_[class~='group/photo-thumbnail']_span]:absolute [&&_[class~='group/photo-thumbnail']_span]:left-[6px] [&&_[class~='group/photo-thumbnail']_span]:bottom-[6px] [&&_[class~='group/photo-thumbnail']_span]:max-w-[calc(100%_-_12px)] [&&_[class~='group/photo-thumbnail']_span]:overflow-hidden [&&_[class~='group/photo-thumbnail']_span]:text-ellipsis [&&_[class~='group/photo-thumbnail']_span]:whitespace-nowrap [&&_[class~='group/photo-thumbnail']_span]:bg-[#163b48d9] [&&_[class~='group/photo-thumbnail']_span]:text-[#fff] [&&_[class~='group/photo-thumbnail']_span]:rounded-[99px] [&&_[class~='group/photo-thumbnail']_span]:[padding:3px_8px] [&&_[class~='group/photo-thumbnail']_span]:text-[length:11px]",
    'max-650:[&&]:grid max-650:[&&]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-650:[&&]:w-[100%] max-650:[&&]:max-w-[168px]',
    "max-650:[&&_[class~='group/photo-thumbnail']]:w-[100%] max-650:[&&_[class~='group/photo-thumbnail']]:h-[auto] max-650:[&&_[class~='group/photo-thumbnail']]:aspect-[1]",
  ].join(' '),
  accountNav: [
    '[&&]:flex [&&]:items-center [&&]:gap-[16px] [&&]:text-[length:14px] [&&]:min-w-[0]',
    '[&&_a]:inline-flex [&&_a]:items-center [&&_a]:gap-[8px] [&&_a]:[background:none] [&&_a]:[border:0] [&&_a]:text-[#365a64] [&&_a]:no-underline [&&_a]:cursor-pointer',
    '[&&_a:focus-visible]:[outline:2px_solid_#087b87] [&&_a:focus-visible]:outline-offset-[3px]',
    'max-650:[&&]:ml-[auto] max-650:[&&]:gap-[10px]',
    'max-650:[&&_a]:text-[length:14px]',
  ].join(' '),
  profileButton: [
    '[&&]:inline-flex [&&]:items-center [&&]:gap-[8px] [&&]:[background:none] [&&]:[border:0] [&&]:text-[#365a64] [&&]:no-underline [&&]:cursor-pointer [&&]:max-w-[220px]',
    '[&&_>_span:last-child]:[overflow-wrap:anywhere] [&&_>_span:last-child]:min-w-[0]',
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[3px]',
    'max-650:[&&]:max-w-[145px]',
  ].join(' '),
  authorButton: [
    'group/author-button',
    '[&&]:inline-flex [&&]:items-center [&&]:gap-[8px] [&&]:[background:none] [&&]:[border:0] [&&]:text-[#365a64] [&&]:no-underline [&&]:cursor-pointer [&&]:text-[length:14px] [&&]:mb-[12px] [&&]:text-left',
    '[&&_>_span:last-child]:[overflow-wrap:anywhere] [&&_>_span:last-child]:min-w-[0]',
    "[&&_[class~='group/avatar']]:w-[26px] [&&_[class~='group/avatar']]:h-[26px] [&&_[class~='group/avatar']]:text-[length:14px]",
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[3px]',
  ].join(' '),
  avatar: [
    'group/avatar',
    '[&&]:inline-grid [&&]:place-items-center [&&]:shrink-0 [&&]:w-[34px] [&&]:h-[34px] [&&]:rounded-[50%] [&&]:bg-[#d9eeef] [&&]:text-[#087b87] [&&]:text-[length:15px] [&&]:font-bold',
  ].join(' '),
  scopeTabs: [
    '[&&]:mt-[28px]',
    "[&&_+_[class~='group/stats']]:mt-[20px]",
    "[&&_[role='tab']]:min-h-[42px] [&&_[role='tab']]:text-[length:14px]",
  ].join(' '),
  profileHeading: [
    '[&&]:flex [&&]:items-center [&&]:gap-[14px] [&&]:[overflow-wrap:anywhere]',
    "[&&_[class~='group/avatar']]:w-[52px] [&&_[class~='group/avatar']]:h-[52px] [&&_[class~='group/avatar']]:text-[length:24px]",
    '[&&_strong]:[overflow-wrap:anywhere]',
  ].join(' '),
  profileBio: [
    '[&&]:whitespace-pre-wrap [&&]:[overflow-wrap:anywhere] [&&]:leading-[1.8]',
  ].join(' '),
  discovery: ['[&&]:[margin:22px_0_54px]', 'max-650:[&&]:mb-[40px]'].join(' '),
  discoveryToolbar: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[14px] [&&]:mb-[24px] [&&]:text-[#607980] [&&]:text-[length:14px]',
    "[&&_[role='tab']]:min-h-[42px] [&&_[role='tab']]:min-w-[72px] [&&_[role='tab']]:text-[length:14px]",
    'max-650:[&&]:flex-wrap',
  ].join(' '),
  discoveryTitle: [
    '[&&]:flex [&&]:items-baseline [&&]:justify-between [&&]:gap-[12px] [&&]:flex-wrap [&&]:mb-[16px]',
    '[&&_h2]:text-[length:22px]',
    '[&&_h2_small]:text-[#087b87] [&&_h2_small]:text-[length:14px] [&&_h2_small]:tracking-[0.08em] [&&_h2_small]:ml-[6px]',
    '[&&_p]:[margin:0] [&&_p]:text-[#607980] [&&_p]:text-[length:14px]',
    'max-650:[&&_h2]:text-[length:21px]',
  ].join(' '),
  fishRanking: ['[&&]:mb-[32px]'].join(' '),
  rankingList: [
    '[&&]:[list-style:none] [&&]:[padding:0] [&&]:[margin:0] [&&]:grid [&&]:grid-cols-[repeat(3,_minmax(0,_1fr))] [&&]:gap-[12px]',
    '[&&_button]:w-[100%] [&&_button]:h-[100%] [&&_button]:flex [&&_button]:items-center [&&_button]:gap-[12px] [&&_button]:text-left [&&_button]:[border:1px_solid_#dce8e9] [&&_button]:rounded-[13px] [&&_button]:[padding:18px_16px] [&&_button]:bg-[#fff] [&&_button]:cursor-pointer [&&_button]:flex-wrap',
    '[&&_button:hover]:bg-[#e7f4f4] [&&_button:hover]:[border-color:#8bbfc4]',
    "[&&_li:first-child_[class~='group/ranking-number']]:bg-[#087b87] [&&_li:first-child_[class~='group/ranking-number']]:text-[#fff]",
    '[&&_button:focus-visible]:[outline:2px_solid_#087b87] [&&_button:focus-visible]:outline-offset-[3px]',
    'max-850:[&&]:grid-cols-[1fr]',
    'max-650:[&&_button]:min-h-[66px]',
  ].join(' '),
  rankingNumber: [
    'group/ranking-number',
    '[&&]:grid [&&]:place-items-center [&&]:rounded-[50%] [&&]:w-[30px] [&&]:h-[30px] [&&]:shrink-0 [&&]:bg-[#e1f1f2] [&&]:text-[#087b87] [&&]:font-bold',
  ].join(' '),
  rankingName: [
    '[&&]:font-bold [&&]:[overflow-wrap:anywhere] [&&]:min-w-[0] [&&]:[flex:1]',
  ].join(' '),
  rankingCount: [
    '[&&]:text-[#607980] [&&]:text-[length:14px] [&&]:whitespace-nowrap',
    '[&&_strong]:text-[#163b48]',
    'max-850:[&&]:ml-[auto]',
  ].join(' '),
  featuredGrid: [
    '[&&]:grid [&&]:grid-cols-[repeat(3,_minmax(0,_1fr))] [&&]:gap-[16px]',
    'max-850:[&&]:gap-[12px]',
    'max-650:[&&]:grid-cols-[1fr]',
  ].join(' '),
  featuredCard: [
    '[&&]:min-w-[0] [&&]:bg-[#fff] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[15px] [&&]:overflow-hidden',
  ].join(' '),
  featuredPhoto: [
    '[&&]:block [&&]:aspect-[4/3] [&&]:bg-[#e1f1f2] [&&]:overflow-hidden',
    '[&&_img]:w-[100%] [&&_img]:h-[100%] [&&_img]:object-cover',
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[3px]',
    'max-650:[&&]:aspect-[16/10]',
    '[button&&]:[padding:0] [button&&]:cursor-pointer [button&&]:w-[100%] [button&&]:[border:0]',
  ].join(' '),
  photoFallback: ['[&&]:grid [&&]:place-items-center [&&]:text-[#54929b]'].join(
    ' ',
  ),
  featuredInfo: [
    '[&&]:[padding:16px]',
    "[&&_[class~='group/author-button']]:mb-[10px]",
    "[&&_[class~='group/place']]:items-start [&&_[class~='group/place']]:[overflow-wrap:anywhere]",
    "[&&_[class~='group/place']_svg]:shrink-0 [&&_[class~='group/place']_svg]:mt-[2px]",
    'max-850:[&&]:[padding:12px]',
    'max-650:[&&]:[padding:16px]',
  ].join(' '),
  featuredHeading: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[8px] [&&]:mb-[10px]',
    '[&&_h3]:[margin:0] [&&_h3]:text-[length:20px] [&&_h3]:[overflow-wrap:anywhere]',
    'max-850:[&&]:flex-wrap',
    'max-650:[&&]:flex-nowrap',
    "max-650:[&&_[class~='group/card-actions']]:flex-row",
    '[&&_h3_small]:text-[length:13px] [&&_h3_small]:text-[#607980] [&&_h3_small]:font-semibold [&&_h3_small]:whitespace-nowrap',
  ].join(' '),
  featuredDate: [
    '[&&]:flex [&&]:items-center [&&]:gap-[6px] [&&]:text-[length:14px] [&&]:text-[#607980] [&&]:[margin:0_0_7px]',
  ].join(' '),
  discoveryEmpty: [
    '[&&]:[border:1px_dashed_#bbd3d7] [&&]:rounded-[13px] [&&]:bg-[#ffffffa6] [&&]:[padding:28px_20px] [&&]:text-[#607980] [&&]:text-[length:14px] [&&]:text-center',
  ].join(' '),
  discoveryLoading: [
    '[&&]:[border:1px_dashed_#bbd3d7] [&&]:rounded-[13px] [&&]:bg-[#ffffffa6] [&&]:[padding:28px_20px] [&&]:text-[#607980] [&&]:text-[length:14px] [&&]:text-center [&&]:[margin:24px_0_40px]',
  ].join(' '),
  logSection: [
    '[&&_h2]:scroll-mt-[24px]',
    '[&&_h2:focus-visible]:[outline:2px_solid_#087b87] [&&_h2:focus-visible]:outline-offset-[5px]',
  ].join(' '),
  fishEditor: [
    '[&&]:[min-inline-size:0] [&&]:[margin:0] [&&]:[border:1px_solid_#d7e5e6] [&&]:rounded-[12px] [&&]:[padding:16px] [&&]:grid [&&]:gap-[14px]',
    '[&&_legend]:[padding:0_7px] [&&_legend]:text-[#365a64] [&&_legend]:text-[length:14px] [&&_legend]:font-bold',
    'max-650:[&&]:[padding:12px]',
  ].join(' '),
  fishRow: [
    '[&&]:grid [&&]:min-w-[0] [&&]:grid-cols-[minmax(0,_1fr)_64px_minmax(0,_0.8fr)_40px] [&&]:gap-[10px] [&&]:[align-items:end] [&&]:[padding:12px] [&&]:[border:1px_solid_#bfdade] [&&]:rounded-[10px] [&&]:bg-[#edf6f6]',
    'max-650:[&&]:grid-cols-[minmax(0,_1fr)_64px]',
    'max-650:[&&_label:nth-child(3)]:col-[1]',
  ].join(' '),
  fishRemove: [
    '[&&]:h-[42px] [&&]:[border:0] [&&]:rounded-[8px] [&&]:bg-[#fff0f1] [&&]:text-[#a33d48] [&&]:grid [&&]:place-items-center [&&]:cursor-pointer',
    '[&&:disabled]:opacity-[0.35] [&&:disabled]:cursor-not-allowed',
    'max-650:[&&]:w-[40px] max-650:[&&]:justify-self-end',
  ].join(' '),
  photoAssignmentGrid: [
    '[&&]:grid [&&]:grid-cols-[repeat(2,_minmax(0,_1fr))] [&&]:gap-[12px] [&&]:mb-[14px]',
    'max-650:[&&]:grid-cols-[1fr]',
  ].join(' '),
  photoAssignment: [
    '[&&]:relative [&&]:grid [&&]:grid-cols-[88px_minmax(0,_1fr)] [&&]:gap-[10px] [&&]:[border:1px_solid_#d7e5e6] [&&]:rounded-[11px] [&&]:[padding:10px] [&&]:bg-[#fff]',
    '[&&_>_img]:w-[122px] [&&_>_img]:h-[88px] [&&_>_img]:object-cover [&&_>_img]:rounded-[8px] [&&_>_img]:row-[span_2]',
    '[&&_select]:w-[100%] [&&_select]:h-[36px] [&&_select]:[border:1px_solid_#d3e1e2] [&&_select]:rounded-[7px] [&&_select]:bg-[#fff] [&&_select]:text-[#163b48] [&&_select]:[padding:0_8px]',
    '[&&_>_button]:absolute [&&_>_button]:right-[4px] [&&_>_button]:top-[4px] [&&_>_button]:[border:0] [&&_>_button]:rounded-[50%] [&&_>_button]:bg-[#fff] [&&_>_button]:text-[#6d858c] [&&_>_button]:w-[30px] [&&_>_button]:h-[30px] [&&_>_button]:grid [&&_>_button]:place-items-center [&&_>_button]:cursor-pointer',
    'max-650:[&&]:grid-cols-[78px_1fr]',
    'max-650:[&&_>_img]:w-[78px] max-650:[&&_>_img]:h-[78px]',
  ].join(' '),
  featuredChoice: [
    '[&&]:flex! [&&]:[grid-auto-flow:column] [&&]:[justify-content:start] [&&]:items-center [&&]:gap-[7px]! [&&]:font-semibold!',
    '[&&_input]:w-[18px] [&&_input]:h-[18px]',
  ].join(' '),
  catchFishList: [
    '[&&]:grid [&&]:gap-[2px] [&&]:mb-[8px]',
    "max-650:[&&_[class~='group/catch-title']]:grid max-650:[&&_[class~='group/catch-title']]:grid-cols-[minmax(0,_1fr)_auto_44px] max-650:[&&_[class~='group/catch-title']]:gap-x-[6px] max-650:[&&_[class~='group/catch-title']]:gap-y-[0] max-650:[&&_[class~='group/catch-title']]:mb-[8px]",
    "max-650:[&&_[class~='group/catch-title']_h3]:col-[1] max-650:[&&_[class~='group/catch-title']_h3]:row-[1] max-650:[&&_[class~='group/catch-title']_h3]:[margin:0] max-650:[&&_[class~='group/catch-title']_h3]:leading-[1.4]",
    "max-650:[&&_[class~='group/count-badge']]:col-[2] max-650:[&&_[class~='group/count-badge']]:row-[1] max-650:[&&_[class~='group/count-badge']]:justify-self-end max-650:[&&_[class~='group/count-badge']]:whitespace-nowrap",
    "max-650:[&&_[class~='group/recipe-trigger']]:col-[3] max-650:[&&_[class~='group/recipe-trigger']]:row-[1]",
    "max-650:[&&_[class~='group/fish-length']]:col-[1_/_3] max-650:[&&_[class~='group/fish-length']]:row-[2] max-650:[&&_[class~='group/fish-length']]:mt-[-4px] max-650:[&&_[class~='group/fish-length']]:pb-[4px]",
  ].join(' '),
  fishLength: [
    'group/fish-length',
    '[&&]:text-[length:13px] [&&]:text-[#66818a]',
  ].join(' '),
  demoControls: [
    '[&&]:mt-[32px] [&&]:[border:1px_dashed_#9ebfc4] [&&]:rounded-[12px] [&&]:[padding:18px] [&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[16px] [&&]:flex-wrap [&&]:text-[#607980] [&&]:text-[length:14px]',
    '[&&_p]:[margin:0]',
    '[&&_button]:min-h-[44px] [&&_button]:whitespace-normal',
  ].join(' '),
  seasonalHero: [
    '[&&]:relative [&&]:max-w-[1671px] [&&]:[margin:0_auto] [&&]:[container-type:inline-size] [&&]:bg-[#e8f2f6]',
    "max-700:[&&_+_[class~='group/container']]:pt-[24px]",
  ].join(' '),
  seasonalHeroArt: [
    '[&&]:aspect-[1671/941] [&&]:relative',
    '[&&_img]:absolute [&&_img]:[inset:0] [&&_img]:block [&&_img]:w-[100%] [&&_img]:h-[100%] [&&_img]:object-contain',
    "[&&::after]:[content:''] [&&::after]:absolute [&&::after]:[inset:auto_0_0] [&&::after]:h-[5%] [&&::after]:[background:linear-gradient(_to_bottom,_transparent,_rgba(224,_240,_247,_0.45)_65%,_#f4f8fa_)] [&&::after]:pointer-events-none",
  ].join(' '),
  seasonalHeroActions: [
    '[&&]:absolute [&&]:left-[6%] [&&]:top-[80%] [&&]:flex [&&]:gap-[1.4cqw] [&&]:max-w-[48%]',
    '[&&_button]:inline-flex [&&_button]:items-center [&&_button]:justify-center [&&_button]:gap-[0.55em] [&&_button]:whitespace-nowrap [&&_button]:cursor-pointer [&&_button]:rounded-[999px] [&&_button]:min-h-[44px] [&&_button]:h-[6.2cqw] [&&_button]:[padding:0_2.4cqw] [&&_button]:text-[length:clamp(13px,_2cqw,_28px)] [&&_button]:font-bold [&&_button]:leading-[1.2] [&&_button]:text-[#fff] [&&_button]:shadow-[0_3px_12px_#00182b26]',
    '[&&_svg]:w-[1.15em] [&&_svg]:h-[1.15em] [&&_svg]:shrink-0',
    '[&&_button:focus-visible]:[outline:3px_solid_#fff] [&&_button:focus-visible]:outline-offset-[4px]',
    'max-700:[&&]:relative max-700:[&&]:left-[auto] max-700:[&&]:top-[auto] max-700:[&&]:max-w-[none] max-700:[&&]:[padding:14px_16px_18px] max-700:[&&]:gap-[10px] max-700:[&&]:bg-[#f4f8fa]',
    'max-700:[&&_button]:h-[46px] max-700:[&&_button]:min-w-[0] max-700:[&&_button]:[padding:0_14px] max-700:[&&_button]:text-[length:14px]',
    "max-700:[&&_[class~='group/hero-record']]:[flex:1]",
    "max-700:[&&_[class~='group/hero-view']]:[flex:1] max-700:[&&_[class~='group/hero-view']]:bg-[#243c49]",
  ].join(' '),
  heroRecord: [
    'group/hero-record',
    '[&&]:bg-[#007aff] [&&]:[border:1px_solid_#007aff]',
    '[&&:hover]:bg-[#0065d6]',
  ].join(' '),
  heroView: [
    'group/hero-view',
    '[&&]:bg-[#111c] [&&]:[border:1.5px_solid_#fff]',
    '[&&:hover]:bg-[#111e]',
  ].join(' '),
  loginScene: [
    '[&&]:[--login-background:#a9d9ee] [&&]:min-h-[100svh] [&&]:grid [&&]:place-items-center [&&]:[background:var(--login-background)] [&&]:text-[#123552] [&&]:overflow-x-clip',
    'max-750:[&&]:block max-750:[&&]:min-h-[100svh] max-750:[&&]:[padding:8svh_0_36px]',
  ].join(' '),
  loginNight: [
    '[&&]:[--login-background:#03172d] [&&]:text-[#f5f9ff]',
    "[&&_[class~='group/google-login-card']]:[background:rgba(4,_18,_35,_0.8)] [&&_[class~='group/google-login-card']]:[border-color:#d1e7ff38] [&&_[class~='group/google-login-card']]:shadow-[0_12px_40px_#0004]",
    "[&&_[class~='group/brand']]:text-[#f0faff]",
    "[&&_[class~='group/brand-english']]:text-[#73c8f1]",
    "[&&_[class~='group/brand-symbol']]:[content:url('/brand/mark-dark.svg')]",
  ].join(' '),
  loginPending: ['[&&]:[--login-background:#e5eef3]'].join(' '),
  loginComposition: [
    '[&&]:relative [&&]:w-[min(100%,_177.3svh)] [&&]:aspect-[1670/942]',
    'max-750:[&&]:w-[100%] max-750:[&&]:aspect-[auto] max-750:[&&]:min-h-[84svh] max-750:[&&]:flex max-750:[&&]:flex-col max-750:[&&]:items-center',
  ].join(' '),
  loginArtFrame: [
    '[&&]:absolute [&&]:[inset:0] [&&]:isolate [&&]:pointer-events-none [&&]:[background:var(--login-background)]',
    "[&&::before]:[content:''] [&&::before]:absolute [&&::before]:[inset:0_0_auto] [&&::before]:h-[clamp(20px,_8%,_30px)] [&&::before]:z-[1] [&&::before]:[background:linear-gradient(to_bottom,_var(--login-background),_transparent)] [&&::before]:pointer-events-none",
    "[&&::after]:[content:''] [&&::after]:absolute [&&::after]:[inset:auto_0_0] [&&::after]:h-[min(18%,_60px)] [&&::after]:[background:linear-gradient(to_bottom,_transparent,_var(--login-background))] [&&::after]:pointer-events-none",
    'max-750:[&&]:relative max-750:[&&]:[inset:auto] max-750:[&&]:w-[100%] max-750:[&&]:aspect-[1670/942] max-750:[&&]:shrink-0',
  ].join(' '),
  loginArt: [
    '[&&]:absolute [&&]:[inset:0] [&&]:block [&&]:w-[100%] [&&]:h-[100%] [&&]:object-contain',
  ].join(' '),
  googleLoginCard: [
    'group/google-login-card',
    '[&&]:z-[1] [&&]:absolute [&&]:right-[5%] [&&]:top-[36%] [&&]:w-[34%] [&&]:[padding:clamp(24px,_3vw,_48px)] [&&]:rounded-[20px] [&&]:[background:rgba(245,_251,_255,_0.83)] [&&]:[border:1px_solid_#ffffffa6] [&&]:shadow-[0_12px_40px_#08294226] [&&]:[backdrop-filter:blur(12px)] [&&]:[-webkit-backdrop-filter:blur(12px)] [&&]:text-center',
    '[&&_h1]:flex [&&_h1]:items-center [&&_h1]:justify-center [&&_h1]:gap-[10px] [&&_h1]:text-[length:clamp(24px,_2.3vw,_36px)] [&&_h1]:tracking-[0.04em] [&&_h1]:leading-[1.4] [&&_h1]:[margin:0_0_22px] [&&_h1]:mb-[24px]',
    '[&&_h1_svg]:w-[28px] [&&_h1_svg]:h-[28px]',
    '[&&_>_p]:text-[length:clamp(14px,_1.15vw,_18px)] [&&_>_p]:leading-[1.7] [&&_>_p]:[margin:0_0_24px]',
    "[&&_[class~='group/google-login-error']]:[margin:20px_0_0] [&&_[class~='group/google-login-error']]:text-[length:14px] [&&_[class~='group/google-login-error']]:text-[inherit]",
    'max-750:[&&]:relative max-750:[&&]:[inset:auto] max-750:[&&]:w-[calc(100%_-_40px)] max-750:[&&]:max-w-[420px] max-750:[&&]:[margin:32px_auto_0] max-750:[&&]:[padding:30px_24px]',
    'max-750:[&&_h1]:text-[length:28px]',
    'max-750:[&&_>_p]:text-[length:15px]',
  ].join(' '),
  googleLoginButton: [
    '[&&]:flex [&&]:items-center [&&]:justify-center [&&]:gap-[12px] [&&]:w-[100%] [&&]:min-h-[54px] [&&]:[padding:12px_14px] [&&]:[border:1px_solid_#b8c6d1] [&&]:rounded-[10px] [&&]:bg-[#fff] [&&]:text-[#243447] [&&]:no-underline [&&]:text-[length:16px] [&&]:font-semibold [&&]:[transition:background_0.15s,_box-shadow_0.15s]',
    '[&&_svg]:w-[22px] [&&_svg]:h-[22px] [&&_svg]:shrink-0',
    '[&&:hover]:bg-[#f1f6fc] [&&:hover]:shadow-[0_3px_12px_#102d4920]',
    '[&&:focus-visible]:[outline:3px_solid_#1686ed] [&&:focus-visible]:outline-offset-[5px]',
    'max-750:[&&]:min-h-[54px]',
  ].join(' '),
  catchDateField: [
    '[&&]:grid [&&]:gap-[8px] [&&]:text-[length:14px] [&&]:font-semibold',
  ].join(' '),
  catchDateTrigger: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[12px] [&&]:w-[100%] [&&]:h-[42px] [&&]:[padding:0_12px] [&&]:[border:1px_solid_#d3e1e2] [&&]:rounded-[8px] [&&]:bg-[#fff] [&&]:text-[#163b48] [&&]:[font:inherit] [&&]:cursor-pointer',
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[2px]',
  ].join(' '),
  catchDatePopover: [
    '[&&]:w-[max-content] [&&]:max-w-[calc(100vw_-_24px)] [&&]:max-h-[var(--radix-popover-content-available-height)] [&&]:overflow-auto [&&]:[padding:8px] [&&]:bg-[#fff] [&&]:text-[#163b48] [&&]:z-[60]',
  ].join(' '),
  catchDateLoading: [
    '[&&]:w-[248px] [&&]:min-h-[350px] [&&]:flex [&&]:flex-col [&&]:items-center [&&]:justify-center [&&]:gap-[12px] [&&]:text-[#607980] [&&]:text-[length:14px]',
  ].join(' '),
  catchDateActions: [
    '[&&]:flex [&&]:justify-end [&&]:gap-[8px] [&&]:[padding:8px]',
    '[&&_button]:min-h-[42px]',
  ].join(' '),
  fieldError: [
    '[&&]:block [&&]:text-[#b42318] [&&]:text-[length:0.8rem] [&&]:font-normal [&&]:leading-[1.5] [&&]:mt-[0.25rem]',
  ].join(' '),
  requiredFieldLabel: ['[&&]:whitespace-nowrap'].join(' '),
  requiredNote: [
    '[&&]:[margin:0] [&&]:text-[#607980] [&&]:text-[length:14px] [&&]:leading-[1.5]',
  ].join(' '),
  photoThumbnail: [
    'group/photo-thumbnail',
    '[&&]:[padding:0] [&&]:cursor-pointer',
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[3px]',
  ].join(' '),
  photoViewer: [
    '[&&]:w-[calc(100%_-_32px)] [&&]:max-w-[960px] [&&]:h-[min(86dvh,_820px)] [&&]:max-h-[calc(100dvh_-_32px)] [&&]:[padding:16px] [&&]:gap-[12px] [&&]:grid-rows-[auto_minmax(0,_1fr)_auto_auto]',
  ].join(' '),
  photoViewerHeader: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[12px] [&&]:min-w-[0]',
  ].join(' '),
  photoViewerTitle: [
    '[&&]:min-w-[0] [&&]:overflow-hidden [&&]:text-ellipsis [&&]:whitespace-nowrap [&&]:text-[length:18px] [&&]:leading-[1.4]',
  ].join(' '),
  photoViewerClose: [
    '[&&]:w-[44px] [&&]:h-[44px] [&&]:shrink-0 [&&]:[padding:0]',
  ].join(' '),
  photoViewerStage: [
    '[&&]:grid [&&]:place-items-center [&&]:min-w-[0] [&&]:min-h-[0] [&&]:overflow-hidden [&&]:rounded-[10px] [&&]:bg-[#102e3a] [&&]:[touch-action:pan-y_pinch-zoom]',
    '[&&_img]:w-[100%] [&&_img]:h-[100%] [&&_img]:min-h-[0] [&&_img]:object-contain',
    '[&&_p]:[padding:16px] [&&_p]:text-[#fff] [&&_p]:leading-[1.7] [&&_p]:[overflow-wrap:anywhere]',
  ].join(' '),
  photoViewerFooter: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[12px]',
    '[&&_button]:min-h-[44px]',
  ].join(' '),
  photoViewerNavigation: [
    '[&&]:flex [&&]:items-center [&&]:gap-[8px] [&&]:min-w-[0]',
  ].join(' '),
  photoViewerArrow: ['[&&]:w-[44px] [&&]:min-w-[44px] [&&]:[padding:0]'].join(
    ' ',
  ),
  photoViewerCount: [
    '[&&]:text-[length:14px] [&&]:text-[#365a64] [&&]:whitespace-nowrap [&&]:tabular-nums',
  ].join(' '),
  photoViewerDetails: [
    '[&&]:min-w-[0] [&&]:max-h-[24dvh] [&&]:overflow-auto [&&]:[overflow-wrap:anywhere]',
  ].join(' '),
  photoViewerFish: [
    '[&&]:flex [&&]:items-baseline [&&]:flex-wrap [&&]:gap-[6px_12px] [&&]:[margin:0] [&&]:leading-[1.5] [&&]:text-[length:15px] [&&]:text-[#163b48]',
    '[&&_strong]:min-w-[0]',
    '[&&_span]:whitespace-nowrap',
  ].join(' '),
  photoViewerLocation: [
    '[&&]:flex [&&]:items-baseline [&&]:flex-wrap [&&]:gap-[6px_12px] [&&]:[margin:0] [&&]:leading-[1.5] [&&]:mt-[4px] [&&]:text-[length:13px] [&&]:text-[#607980]',
  ].join(' '),
  brandSymbol: [
    'group/brand-symbol',
    '[&&]:w-[72px] [&&]:h-[52px] [&&]:shrink-0',
    'max-650:[&&]:w-[58px] max-650:[&&]:h-[42px]',
  ].join(' '),
  brandWordmark: [
    'group/brand-wordmark',
    '[&&]:flex [&&]:flex-col [&&]:items-start [&&]:gap-[5px]',
  ].join(' '),
  brandName: [
    'group/brand-name',
    '[&&]:text-[length:23px] [&&]:font-black [&&]:tracking-[0.07em] [&&]:leading-[1.2] [&&]:whitespace-nowrap',
    'max-650:[&&]:text-[length:20px]',
  ].join(' '),
  brandEnglish: [
    'group/brand-english',
    '[&&]:text-[length:10px] [&&]:font-bold [&&]:tracking-[0.17em] [&&]:leading-[1] [&&]:text-[#083653] [&&]:whitespace-nowrap',
    'max-650:[&&]:text-[length:9px]',
  ].join(' '),
  brandLogin: [
    '[&&]:flex-col [&&]:gap-[12px]',
    "[&&_[class~='group/brand-symbol']]:w-[122px] [&&_[class~='group/brand-symbol']]:h-[88px]",
    "[&&_[class~='group/brand-wordmark']]:items-center [&&_[class~='group/brand-wordmark']]:gap-[9px]",
    "[&&_[class~='group/brand-name']]:text-[length:clamp(26px,_2.3vw,_36px)]",
    "[&&_[class~='group/brand-english']]:text-[length:12px] [&&_[class~='group/brand-english']]:tracking-[0.22em]",
    "max-650:[&&_[class~='group/brand-symbol']]:w-[111px] max-650:[&&_[class~='group/brand-symbol']]:h-[80px]",
  ].join(' '),
  fishingMapPanel: [
    '[&&]:[margin:20px_0] [&&]:[padding:18px] [&&]:[border:1px_solid_#d9e4e5] [&&]:rounded-[14px] [&&]:bg-[#fff] [&&]:min-w-[0]',
    '[&&_button]:[border:1px_solid_#cddcde] [&&_button]:rounded-[7px] [&&_button]:[padding:8px_12px] [&&_button]:bg-[#f5f9f9] [&&_button]:text-[#174d53] [&&_button]:cursor-pointer',
    '[&&_button:disabled]:opacity-[0.6] [&&_button:disabled]:cursor-wait',
    'max-600:[&&]:[padding:12px]',
  ].join(' '),
  positionEditor: [
    'group/position-editor',
    '[&&]:[margin:20px_0] [&&]:[padding:18px] [&&]:[border:1px_solid_#d9e4e5] [&&]:rounded-[14px] [&&]:bg-[#fff] [&&]:min-w-[0]',
    '[&&_legend]:font-semibold [&&_legend]:[padding:0_6px]',
    "[&&_[class~='group/google-map']]:h-[280px]",
    '[&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cddcde] [&&_select]:rounded-[6px] [&&_select]:max-w-[100%] [&&_select]:bg-white [&&_select]:text-[#24444a]',
    '[&&_button]:[border:1px_solid_#cddcde] [&&_button]:rounded-[7px] [&&_button]:[padding:8px_12px] [&&_button]:bg-[#f5f9f9] [&&_button]:text-[#174d53] [&&_button]:cursor-pointer',
    '[&&_button:disabled]:opacity-[0.6] [&&_button:disabled]:cursor-wait',
    '[&&_p]:[overflow-wrap:anywhere]',
    'max-600:[&&]:[padding:12px]',
  ].join(' '),
  googleMap: [
    'group/google-map',
    '[&&]:h-[360px] [&&]:w-[100%] [&&]:rounded-[10px] [&&]:bg-[#eef4f5] [&&]:mt-[12px]',
    'max-600:[&&]:h-[300px]',
  ].join(' '),
  mapFilters: [
    '[&&]:flex [&&]:flex-wrap [&&]:gap-[10px] [&&]:[align-items:end] [&&]:[margin:12px_0]',
    '[&&_label]:flex [&&_label]:flex-col [&&_label]:gap-[6px] [&&_label]:min-w-[0]',
    '[&&_input]:[padding:8px] [&&_input]:[border:1px_solid_#cddcde] [&&_input]:rounded-[6px] [&&_input]:max-w-[100%] [&&_input]:bg-white [&&_input]:text-[#24444a]',
    '[&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cddcde] [&&_select]:rounded-[6px] [&&_select]:max-w-[100%] [&&_select]:bg-white [&&_select]:text-[#24444a]',
    'max-600:[&&_>_label]:[flex:1_1_130px]',
  ].join(' '),
  mapSearch: [
    '[&&]:flex [&&]:flex-wrap [&&]:gap-[10px] [&&]:[align-items:end] [&&]:[margin:12px_0]',
    '[&&_input]:[padding:8px] [&&_input]:[border:1px_solid_#cddcde] [&&_input]:rounded-[6px] [&&_input]:max-w-[100%] [&&_input]:bg-white [&&_input]:text-[#24444a] [&&_input]:[flex:1] [&&_input]:min-w-[130px]',
    'max-600:[&&]:items-stretch',
  ].join(' '),
  mapActions: [
    '[&&]:flex [&&]:flex-wrap [&&]:gap-[10px] [&&]:[align-items:end] [&&]:[margin:12px_0]',
  ].join(' '),
  spotEdit: [
    '[&&_label]:flex [&&_label]:flex-col [&&_label]:gap-[6px] [&&_label]:min-w-[0]',
    '[&&_input]:[padding:8px] [&&_input]:[border:1px_solid_#cddcde] [&&_input]:rounded-[6px] [&&_input]:max-w-[100%] [&&_input]:bg-white [&&_input]:text-[#24444a]',
  ].join(' '),
  mapCheck: ['[&&]:flex-row! [&&]:items-center'].join(' '),
  spotList: [
    '[&&]:flex [&&]:flex-wrap [&&]:gap-[8px]',
    "[&&_button[aria-pressed='true']]:bg-[#174d53] [&&_button[aria-pressed='true']]:text-[white]",
  ].join(' '),
  spotDetail: [
    '[&&]:mt-[18px] [&&]:[border-top:1px_solid_#d9e4e5] [&&]:pt-[16px]',
    '[&&_article]:mt-[12px] [&&_article]:[border-bottom:1px_solid_#edf1f1] [&&_article]:[padding:10px_0]',
    '[&&_img]:w-[80px] [&&_img]:h-[80px] [&&_img]:object-cover [&&_img]:[margin:4px] [&&_img]:rounded-[8px]',
  ].join(' '),
  mapNotice: [
    '[&&]:bg-[#eef4f5] [&&]:[padding:12px] [&&]:rounded-[8px] [&&]:[margin:12px_0]',
  ].join(' '),
  recipeTrigger: [
    'group/recipe-trigger',
    '[&&]:inline-flex [&&]:items-center [&&]:justify-center [&&]:w-[44px] [&&]:min-h-[44px] [&&]:[padding:0] [&&]:[border:0] [&&]:rounded-[8px] [&&]:bg-transparent [&&]:cursor-pointer [&&]:shrink-0',
    '[&&_svg]:opacity-[0.75] [&&_svg]:[transition:opacity_0.15s]',
    '[&&:hover]:bg-[#edf6f6]',
    '[&&:hover_svg]:opacity-[1]',
    '[&&:focus-visible_svg]:opacity-[1]',
    "[&&[aria-expanded='true']_svg]:opacity-[1]",
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[2px]',
  ].join(' '),
  recipePopover: [
    '[&&_a:focus-visible]:[outline:2px_solid_#087b87] [&&_a:focus-visible]:outline-offset-[2px]',
    '[&&]:w-[280px] [&&]:max-w-[calc(100vw_-_24px)] [&&]:max-h-[var(--radix-popover-content-available-height)] [&&]:overflow-y-auto [&&]:bg-[#fff] [&&]:text-[#163b48] [&&]:[padding:14px] [&&]:rounded-[12px]',
    '[&&_a]:flex [&&_a]:items-center [&&_a]:min-h-[44px] [&&_a]:[padding:10px_8px] [&&_a]:rounded-[7px] [&&_a]:text-[length:14px] [&&_a]:no-underline [&&_a]:text-[#087b87] [&&_a]:font-bold',
    '[&&_a:hover]:bg-[#edf6f6]',
  ].join(' '),
  recipeClose: [
    '[&&:focus-visible]:[outline:2px_solid_#087b87] [&&:focus-visible]:outline-offset-[2px]',
    '[&&]:block [&&]:min-h-[44px] [&&]:[margin:6px_0_0_auto] [&&]:[padding:8px_12px] [&&]:[border:0] [&&]:rounded-[7px] [&&]:bg-[#edf6f6] [&&]:text-[#365a64] [&&]:cursor-pointer [&&]:text-[length:13px]',
  ].join(' '),
  recipeHeading: [
    '[&&]:text-[length:14px] [&&]:font-bold [&&]:[margin:0_0_6px] [&&]:[overflow-wrap:anywhere]',
  ].join(' '),
  recipeHint: [
    '[&&]:text-[length:12px] [&&]:text-[#526f78] [&&]:leading-[1.6] [&&]:[margin:0_0_8px] [&&]:[overflow-wrap:anywhere]',
  ].join(' '),
  locationMapTrigger: [
    '[&&]:[background:none] [&&]:[border:0] [&&]:[padding:6px_0] [&&]:cursor-pointer [&&]:text-left [&&]:underline [&&]:[text-underline-offset:3px] [&&]:[font:inherit] [&&]:max-w-[100%] [&&]:[overflow-wrap:anywhere]',
    '[&&:hover]:text-[#087e8b]',
    '[&&:focus-visible]:[outline:2px_solid_#087e8b] [&&:focus-visible]:outline-offset-[3px] [&&:focus-visible]:rounded-[4px]',
  ].join(' '),
  locationMapDialog: [
    '[&&]:bg-[#fff] [&&]:text-[#163b48] [&&]:w-[calc(100%_-_2rem)] [&&]:max-w-[680px]! [&&]:max-h-[calc(100dvh_-_2rem)] [&&]:overflow-y-auto',
    "[&&_[class~='group/google-map']]:h-[min(420px,_50dvh)]",
    "[&&_[data-cy='location-exact']]:[overflow-wrap:anywhere]",
    "[&&_[data-slot='dialog-title']]:pr-[24px] [&&_[data-slot='dialog-title']]:[overflow-wrap:anywhere]",
  ].join(' '),
  primaryNav: [
    '[&&]:flex [&&]:justify-center [&&]:gap-[12px] [&&]:[padding:10px_20px] [&&]:bg-[#fff] [&&]:[border-bottom:1px_solid_#dce8e9]',
    '[&&_button]:flex [&&_button]:items-center [&&_button]:justify-center [&&_button]:gap-[8px] [&&_button]:[padding:10px_24px] [&&_button]:rounded-[10px] [&&_button]:text-[#546d75] [&&_button]:min-h-[44px]',
    "[&&_button[aria-current='page']]:bg-[#e0f3f2] [&&_button[aria-current='page']]:text-[#087b87] [&&_button[aria-current='page']]:font-bold",
    '[&&_button:focus-visible]:[outline:2px_solid_#087b87] [&&_button:focus-visible]:outline-offset-[2px]',
    'max-650:[&&]:fixed max-650:[&&]:bottom-[0] max-650:[&&]:left-[0] max-650:[&&]:right-[0] max-650:[&&]:z-[30] max-650:[&&]:grid max-650:[&&]:grid-cols-[repeat(3,_minmax(0,_1fr))] max-650:[&&]:[padding:8px_10px_calc(8px_+_env(safe-area-inset-bottom))] max-650:[&&]:[border-top:1px_solid_#dce8e9] max-650:[&&]:shadow-[0_-2px_12px_#163b4810] max-650:[&&]:gap-[6px]',
    'max-650:[&&_button]:flex-col max-650:[&&_button]:gap-[4px] max-650:[&&_button]:[padding:8px_4px] max-650:[&&_button]:text-[length:12px]',
  ].join(' '),
  gearTabs: [
    "[&&_button[aria-selected='true']]:bg-[#e0f3f2] [&&_button[aria-selected='true']]:text-[#087b87] [&&_button[aria-selected='true']]:font-bold",
    '[&&_button:focus-visible]:[outline:2px_solid_#087b87] [&&_button:focus-visible]:outline-offset-[2px]',
    '[&&]:flex [&&]:flex-wrap [&&]:items-center [&&]:gap-[10px] [&&]:[margin:14px_0]',
    '[&&_button]:min-h-[44px] [&&_button]:[padding:10px_18px] [&&_button]:rounded-[10px]',
  ].join(' '),
  gearManager: [
    '[&&]:pt-[30px] [&&]:pb-[40px]',
    '[&&_h1]:text-[length:26px] [&&_h1]:font-extrabold [&&_h1]:mb-[12px]',
    '[&&_h2]:text-[length:19px] [&&_h2]:font-bold [&&_h2]:[margin:14px_0]',
    '[&&_h3]:font-bold',
    '[&&_select]:w-[100%] [&&_select]:min-h-[42px] [&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cbdcde] [&&_select]:rounded-[8px] [&&_select]:bg-[#fff]',
    'max-650:[&&]:pt-[20px] max-650:[&&]:pb-[40px]',
  ].join(' '),
  myPage: [
    '[&&]:pt-[30px] [&&]:pb-[40px]',
    '[&&_h1]:text-[length:26px] [&&_h1]:font-extrabold [&&_h1]:mb-[12px]',
    '[&&_h2]:text-[length:19px] [&&_h2]:font-bold [&&_h2]:[margin:14px_0]',
    '[&&_progress]:w-[100%] [&&_progress]:[accent-color:#087b87]',
    'max-650:[&&]:pt-[20px] max-650:[&&]:pb-[40px]',
  ].join(' '),
  gearActions: [
    'group/gear-actions',
    '[&&]:flex [&&]:flex-wrap [&&]:items-center [&&]:gap-[10px] [&&]:[margin:14px_0]',
    '[&&_>_button]:min-h-[40px] [&&_>_button]:whitespace-normal [&&_>_button]:h-[auto]',
    'max-650:[&&_>_button]:max-w-[100%]',
  ].join(' '),
  gearFilters: [
    '[&&]:flex [&&]:flex-wrap [&&]:items-center [&&]:gap-[10px] [&&]:[margin:14px_0]',
    '[&&_>_input]:max-w-[340px]',
    '[&&_select]:w-[auto]',
  ].join(' '),
  gearPicker: [
    '[&&_select]:w-[100%] [&&_select]:min-h-[42px] [&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cbdcde] [&&_select]:rounded-[8px] [&&_select]:bg-[#fff]',
    '[&&]:grid [&&]:gap-[10px]',
  ].join(' '),
  combinationEditor: [
    'group/combination-editor',
    '[&&_select]:w-[100%] [&&_select]:min-h-[42px] [&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cbdcde] [&&_select]:rounded-[8px] [&&_select]:bg-[#fff]',
    '[&&]:[border:1px_solid_#cbdcde] [&&]:[padding:12px] [&&]:rounded-[12px] [&&]:min-w-[0]',
    '[&&_legend]:font-bold [&&_legend]:[padding:0_6px]',
  ].join(' '),
  gearKindList: ['[&&]:mt-[16px]'].join(' '),
  gearKindGroup: ['[&&]:[border-color:#dce8e9]', '[&&_>_h3]:[margin:0]'].join(
    ' ',
  ),
  gearKindToggle: [
    '[&&]:min-h-[56px] [&&]:items-center [&&]:[padding:14px_4px] [&&]:text-[length:18px] [&&]:font-bold',
  ].join(' '),
  gearKindTitle: [
    '[&&]:inline-flex [&&]:items-center [&&]:gap-[10px] [&&]:min-w-[0]',
  ].join(' '),
  gearKindCount: [
    '[&&]:[padding:2px_8px] [&&]:rounded-[999px] [&&]:bg-[#e0f3f2] [&&]:text-[#087b87] [&&]:text-[length:12px] [&&]:font-semibold [&&]:whitespace-nowrap',
  ].join(' '),
  gearKindContent: ["[&&_[class~='group/gear-card']]:[margin:0]"].join(' '),
  gearGrid: [
    '[&&]:grid [&&]:grid-cols-[repeat(auto-fit,_minmax(min(100%,_300px),_1fr))] [&&]:gap-[16px]',
  ].join(' '),
  gearCard: [
    'group/gear-card',
    '[&&]:min-w-[0] [&&]:bg-[#fff] [&&]:[padding:18px] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[12px] [&&]:[margin:14px_0] [&&]:[overflow-wrap:anywhere]',
    '[&&_p]:whitespace-pre-wrap [&&_p]:[margin:8px_0]',
  ].join(' '),
  gearEdit: [
    'group/gear-edit',
    '[&&]:min-w-[0] [&&]:bg-[#fff] [&&]:[padding:18px] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[12px] [&&]:[margin:14px_0] [&&]:[overflow-wrap:anywhere] [&&]:max-w-[720px]',
  ].join(' '),
  gearHistoryCard: [
    '[&&]:min-w-[0] [&&]:bg-[#fff] [&&]:[padding:18px] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[12px] [&&]:[margin:14px_0] [&&]:[overflow-wrap:anywhere]',
  ].join(' '),
  combinationCard: [
    'group/combination-card',
    '[&&]:min-w-[0] [&&]:bg-[#fff] [&&]:[padding:18px] [&&]:[border:1px_solid_#dce8e9] [&&]:rounded-[12px] [&&]:[margin:14px_0] [&&]:[overflow-wrap:anywhere] [&&]:grid [&&]:gap-[12px]',
    '[&&_>_button]:min-h-[44px] [&&_>_button]:whitespace-normal [&&_>_button]:h-[auto]',
  ].join(' '),
  combinationSummary: [
    '[&&_p]:whitespace-pre-wrap [&&_p]:[margin:8px_0]',
    '[&&]:[border-left:3px_solid_#aad8d4] [&&]:[padding:10px] [&&]:[margin:10px_0] [&&]:text-[length:13px]',
  ].join(' '),
  gearCheck: [
    '[&&]:flex! [&&]:items-center [&&]:gap-[8px] [&&]:min-h-[40px] [&&]:font-normal',
    '[&&_input]:w-[18px] [&&_input]:h-[18px] [&&_input]:shrink-0',
  ].join(' '),
  gearOptions: [
    '[&&_label]:flex! [&&_label]:items-center [&&_label]:gap-[8px] [&&_label]:min-h-[40px] [&&_label]:font-normal',
    '[&&_input]:w-[18px] [&&_input]:h-[18px] [&&_input]:shrink-0',
    '[&&]:max-h-[200px] [&&]:overflow-y-auto [&&]:[border:1px_solid_#e1ebec] [&&]:rounded-[8px] [&&]:[padding:8px]',
  ].join(' '),
  gearSpecies: [
    '[&&_label]:flex! [&&_label]:items-center [&&_label]:gap-[8px] [&&_label]:min-h-[40px] [&&_label]:font-normal',
    '[&&_input]:w-[18px] [&&_input]:h-[18px] [&&_input]:shrink-0',
    '[&&]:flex [&&]:flex-wrap [&&]:items-center [&&]:gap-[10px]',
  ].join(' '),
  gearHelp: [
    'group/gear-help',
    '[&&]:text-[length:13px] [&&]:leading-[1.6] [&&]:text-[#586d75] [&&]:[margin:8px_0]',
  ].join(' '),
  gearChip: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[10px] [&&]:bg-[#edf7f6] [&&]:[padding:6px_10px] [&&]:rounded-[8px] [&&]:[margin:4px_0] [&&]:text-[length:13px]',
    '[&&_button]:min-w-[36px] [&&_button]:min-h-[36px] [&&_button]:text-[length:20px]',
  ].join(' '),
  retiredNote: ['[&&]:block [&&]:text-[#9a4916] [&&]:text-[length:13px]'].join(
    ' ',
  ),
  gearInlineAdd: ['[&&]:grid [&&]:gap-[12px]'].join(' '),
  gearPrivateMemo: ['[&&]:text-[#586d75] [&&]:text-[length:13px]'].join(' '),
  gearHistory: [
    '[&&]:pt-[12px]',
    '[&&_>_label]:grid [&&_>_label]:gap-[8px]',
  ].join(' '),
  catchCombinations: [
    '[&&_summary]:cursor-pointer [&&_summary]:[padding:8px_0] [&&_summary]:text-[length:13px] [&&_summary]:text-[#087b87]',
  ].join(' '),
  combinationHeading: [
    '[&&]:flex [&&]:items-center [&&]:justify-between [&&]:gap-[8px]',
    '[&&_button]:min-h-[44px] [&&_button]:whitespace-normal [&&_button]:h-[auto]',
  ].join(' '),
  combinationOverview: [
    '[&&]:text-[#586d75] [&&]:text-[length:13px] [&&]:leading-[1.7]',
  ].join(' '),
  combinationDetails: [
    '[&&:not([hidden])]:grid [&&:not([hidden])]:gap-[12px]',
  ].join(' '),
  gearEditDialog: [
    '[&&]:flex [&&]:flex-col [&&]:w-[min(720px,_calc(100%_-_24px))] [&&]:max-w-[720px] [&&]:max-h-[calc(_100dvh_-_24px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_)] [&&]:overflow-clip',
    "[&&_[data-slot='dialog-header']]:shrink-0 [&&_[data-slot='dialog-header']]:pr-[60px] [&&_[data-slot='dialog-header']]:text-left",
    "[&&_[class~='group/gear-edit']]:flex [&&_[class~='group/gear-edit']]:flex-col [&&_[class~='group/gear-edit']]:[flex:1] [&&_[class~='group/gear-edit']]:min-h-[0] [&&_[class~='group/gear-edit']]:overflow-clip [&&_[class~='group/gear-edit']]:[padding:0] [&&_[class~='group/gear-edit']]:[margin:0] [&&_[class~='group/gear-edit']]:[border:0] [&&_[class~='group/gear-edit']]:max-w-[none]",
    '[&&_select]:w-[100%] [&&_select]:min-h-[44px] [&&_select]:[padding:8px] [&&_select]:[border:1px_solid_#cbdcde] [&&_select]:rounded-[8px] [&&_select]:bg-[#fff]',
    "[&&_[class~='group/gear-dialog-footer']]:shrink-0 [&&_[class~='group/gear-dialog-footer']]:[margin:0] [&&_[class~='group/gear-dialog-footer']]:[padding:12px_0_0] [&&_[class~='group/gear-dialog-footer']]:[border-top:1px_solid_#dce8e9]",
  ].join(' '),
  gearDialogClose: [
    '[&&]:absolute [&&]:top-[12px] [&&]:right-[12px] [&&]:min-h-[44px]',
  ].join(' '),
  gearDialogFieldset: ['[&&]:contents'].join(' '),
  gearDialogFields: [
    '[&&]:grid [&&]:[align-content:start] [&&]:[flex:1] [&&]:gap-[16px] [&&]:min-w-[0] [&&]:min-h-[0] [&&]:overflow-y-auto [&&]:[padding:0_4px_4px_0] [&&]:scroll-p-[8px]',
  ].join(' '),
  gearDialogFooter: [
    'group/gear-dialog-footer',
    '[&&_>_button]:[flex:1] [&&_>_button]:min-h-[44px]',
  ].join(' '),
  methodField: [
    '[&&]:grid [&&]:gap-[7px] [&&]:min-w-[0]',
    "[&&_>_[data-slot='input-group']]:w-[100%] [&&_>_[data-slot='input-group']]:min-h-[44px] [&&_>_[data-slot='input-group']]:h-[auto]",
    "[&&_[data-slot='input-group-addon']:empty]:hidden",
  ].join(' '),
  methodTrigger: [
    '[&&]:inline-flex [&&]:items-center [&&]:justify-center [&&]:min-w-[44px] [&&]:min-h-[44px] [&&]:shrink-0',
  ].join(' '),
  methodOptions: [
    "[&&_[data-slot='combobox-item']]:min-h-[44px]",
    "[&&_[data-slot='combobox-list']]:max-h-[min(240px,_var(--available-height))]",
  ].join(' '),
  combinationChevron: [
    '[&&]:shrink-0 [&&]:[transition:transform_150ms]',
    "[&&[class~='group/expanded']]:[transform:rotate(180deg)]",
  ].join(' '),
  catchSection: [
    'group/catch-section',
    "[&&_[class~='group/position-editor']]:[margin:0] [&&_[class~='group/position-editor']]:[padding:12px] [&&_[class~='group/position-editor']]:bg-[#f5f9f9]",
    "[&&_[class~='group/position-editor']_>_legend]:text-[length:14px]",
  ].join(' '),
  likeButton: ['group/like-button'].join(' '),
  isLiked: ['group/is-liked'].join(' '),
  googleLoginError: ['group/google-login-error'].join(' '),
  expanded: ['group/expanded'].join(' '),
};

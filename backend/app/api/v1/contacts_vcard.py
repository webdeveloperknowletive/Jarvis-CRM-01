from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.lead import Lead

router = APIRouter(prefix="/leads", tags=["vCard Contacts"])

@router.get("/{lead_id}/vcard", response_class=Response)
def get_lead_vcard(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.organization_id == tenant_id
    ).first()

    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Security constraint: only the assigned telecaller or managers/admins can export vCard
    if lead.owner_id != current_user.id and not current_user.is_org_admin and current_user.tenant_role not in ("ORG_ADMIN", "SALES_MANAGER"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this lead's vCard")

    # Generate vCard content
    fn = lead.contact_name or lead.title or "Unknown Contact"
    org = lead.company_name or ""
    tel = lead.contact_phone or ""
    email = lead.contact_email or ""
    
    # We include Product and Purpose in the NOTE field to give context
    notes = []
    if lead.product_service_name:
        notes.append(f"Product/Service: {lead.product_service_name}")
    if lead.purpose:
        notes.append(f"Purpose: {lead.purpose}")
    
    note_str = " | ".join(notes)

    vcard_lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"FN:{fn}",
        f"N:{fn};;;;",
    ]
    
    if org:
        vcard_lines.append(f"ORG:{org}")
    if tel:
        vcard_lines.append(f"TEL;TYPE=CELL:{tel}")
    if email:
        vcard_lines.append(f"EMAIL;TYPE=WORK:{email}")
    if note_str:
        vcard_lines.append(f"NOTE:{note_str}")
        
    vcard_lines.append("END:VCARD")
    vcard_content = "\r\n".join(vcard_lines)

    # Sanitize filename
    safe_fn = "".join([c for c in fn if c.isalpha() or c.isdigit() or c==' ']).rstrip().replace(" ", "_")
    filename = f"{safe_fn}.vcf"

    return Response(
        content=vcard_content,
        media_type="text/vcard",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
